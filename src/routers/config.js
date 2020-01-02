import express from 'express';
import Component from '../models/component';
import GroupConfig from '../models/group-config';
import Config from '../models/config';
import { auth } from '../middleware/auth';
import { checkEnvironmentStatusChange, verifyInputUpdateParameters } from '../middleware/validators';
import { removeConfigStatus, verifyOwnership, responseException } from './common/index'
import { ActionTypes, RouterTypes } from '../models/role';

const router = new express.Router()

router.post('/config/create', auth, async (req, res) => {
    try {
        const group = await GroupConfig.findById(req.body.group)

        if (!group) {
            return res.status(404).send({ error: 'Group Config not found' })
        }
    
        let config = new Config({
            ...req.body,
            domain: group.domain,
            owner: req.admin._id
        })

        config = await verifyOwnership(req.admin, config, group.domain, ActionTypes.CREATE, RouterTypes.CONFIG)

        await config.save()
        res.status(201).send(config)
    } catch (e) {
        responseException(res, e, 400)
    }
})

// GET /config?group=ID&limit=10&skip=20
// GET /config?group=ID&sortBy=createdAt:desc
// GET /config?group=ID
router.get('/config', auth, async (req, res) => {
    const sort = {}

    if (req.query.sortBy) {
        const parts = req.query.sortBy.split(':')
        sort[parts[0]] = parts[1] === 'desc' ? -1 : 1
    }

    try {
        const groupConfig = await GroupConfig.findById(req.query.group)

        if (!groupConfig) {
            return res.status(404).send() 
        }

        await groupConfig.populate({
            path: 'config',
            options: {
                limit: parseInt(req.query.limit),
                skip: parseInt(req.query.skip),
                sort
            }
        }).execPopulate()

        let configs = groupConfig.config

        configs = await verifyOwnership(req.admin, configs, groupConfig.domain, ActionTypes.READ, RouterTypes.CONFIG)

        res.send(configs)
    } catch (e) {
        responseException(res, e, 500)
    }
})

router.get('/config/:id', auth, async (req, res) => {
    try {
        let config = await Config.findById(req.params.id)

        if (!config) {
            return res.status(404).send()
        }

        config = await verifyOwnership(req.admin, config, config.domain, ActionTypes.READ, RouterTypes.CONFIG)

        res.send(config)
    } catch (e) {
        responseException(res, e, 500)
    }
})

// GET /config/ID?sortBy=createdAt:desc
// GET /config/ID?limit=10&skip=20
// GET /config/ID
router.get('/config/history/:id', auth, async (req, res) => {
    const sort = {}

    if (req.query.sortBy) {
        const parts = req.query.sortBy.split(':')
        sort[`${parts[0]}.${parts[1]}`] = parts[2] === 'desc' ? -1 : 1
    }

    try {
        const config = await Config.findById(req.params.id)

        if (!config) {
            return res.status(404).send()
        }

        await config.populate({
            path: 'history',
            select: 'oldValue newValue -_id',
            options: {
                limit: parseInt(req.query.limit),
                skip: parseInt(req.query.skip),
                sort
            }
        }).execPopulate()

        let history = config.history;

        history = await verifyOwnership(req.admin, history, config.domain, ActionTypes.READ, RouterTypes.CONFIG)

        res.send(history)
    } catch (e) {
        responseException(res, e, 500)
    }
})

router.delete('/config/:id', auth, async (req, res) => {
    try {
        let config = await Config.findById(req.params.id)

        if (!config) {
            return res.status(404).send()
        }

        config = await verifyOwnership(req.admin, config, config.domain, ActionTypes.DELETE, RouterTypes.CONFIG)

        await config.remove()
        res.send(config)
    } catch (e) {
        responseException(res, e, 500)
    }
})

router.patch('/config/:id', auth,
    verifyInputUpdateParameters(['key', 'description']), async (req, res) => {
    try {
        let config = await Config.findById(req.params.id)
 
        if (!config) {
            return res.status(404).send()
        }

        config = await verifyOwnership(req.admin, config, config.domain, ActionTypes.UPDATE, RouterTypes.CONFIG)

        req.updates.forEach((update) => config[update] = req.body[update])
        await config.save()
        res.send(config)
    } catch (e) {
        responseException(res, e, 500)
    }
})

router.patch('/config/updateStatus/:id', auth, async (req, res) => {
    try {
        let config = await Config.findById(req.params.id)
        
        if (!config) {
            return res.status(404).send({ error: 'Config does not exist'})
        }

        config = await verifyOwnership(req.admin, config, config.domain, ActionTypes.UPDATE, RouterTypes.CONFIG)

        const updates = await checkEnvironmentStatusChange(req, res, config.domain)
        
        updates.forEach((update) => config.activated.set(update, req.body[update]))
        await config.save()
        res.send(config)
    } catch (e) {
        responseException(res, e, 400)
    }
})

router.patch('/config/removeStatus/:id', auth, async (req, res) => {
    try {
        let config = await Config.findById(req.params.id)

        if (!config) {
            return res.status(404).send({ error: 'Config does not exist'})
        }

        config = await verifyOwnership(req.admin, config, config.domain, ActionTypes.UPDATE, RouterTypes.CONFIG)

        res.send(await removeConfigStatus(config, req.body.env))
    } catch (e) {
        responseException(res, e, 400)
    }
})

router.patch('/config/addComponent/:id', auth, async (req, res) => {
    try {
        let config = await Config.findById(req.params.id)
            
        if (!config) {
            return res.status(404).send()
        }

        config = await verifyOwnership(req.admin, config, config.domain, ActionTypes.UPDATE, RouterTypes.CONFIG)

        const component = await Component.findOne({ name: req.body.component })

        if (!component) {
            return res.status(404).send({ error: `Component ${req.body.component} not found` })
        }

        config.components.push(component.name)
        await config.save()
        res.send(config)
    } catch (e) {
        responseException(res, e, 500)
    }
})

router.patch('/config/removeComponent/:id', auth, async (req, res) => {
    try {
        let config = await Config.findById(req.params.id)
            
        if (!config) {
            return res.status(404).send()
        }

        config = await verifyOwnership(req.admin, config, config.domain, ActionTypes.UPDATE, RouterTypes.CONFIG)

        const component = await Component.findOne({ name: req.body.component })

        if (!component) {
            return res.status(404).send({ error: `Component ${req.body.component} not found` })
        }

        config.components = config.components.filter(element => element !== req.body.component)
        await config.save()
        res.send(config)
    } catch (e) {
        responseException(res, e, 500)
    }
})

export default router;