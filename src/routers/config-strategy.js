import express from 'express';
import Config from '../models/config';
import { Environment } from '../models/environment';
import { checkEnvironmentStatusChange, verifyInputUpdateParameters } from '../middleware/validators';
import { ConfigStrategy, strategyRequirements } from '../models/config-strategy';
import { auth } from '../middleware/auth';
import { removeConfigStrategyStatus, verifyOwnership, responseException } from './common/index';
import { ActionTypes, RouterTypes } from '../models/role';

const router = new express.Router()

router.post('/configstrategy/create', auth, async (req, res) => {
    try {
        const config = await Config.findById(req.body.config)

        if (!config) {
            return res.status(404).send({ error: 'Config not found' })
        }

        if (!req.body.env) {
            return res.status(400).send({ error: 'Must specify environment' })
        }

        const environment = await Environment.findOne({ name: req.body.env, domain: config.domain })

        if (!environment) {
            return res.status(400).send({ error: 'Environment does not exist' })
        }

        let configStrategy = new ConfigStrategy({
            ...req.body,
            activated: new Map().set(environment.name, true),
            domain: config.domain,
            owner: req.admin._id
        })

        configStrategy = await verifyOwnership(req.admin, configStrategy, configStrategy.domain, ActionTypes.CREATE, RouterTypes.STRATEGY);

        await configStrategy.save()
        res.status(201).send(configStrategy)
    } catch (e) {
        responseException(res, e, 400)
    }
})

// GET /configstrategy?limit=10&skip=20
// GET /configstrategy?sortBy=createdAt:desc
// GET /configstrategy?config=ID
router.get('/configstrategy', auth, async (req, res) => {
    const sort = {}

    if (req.query.sortBy) {
        const parts = req.query.sortBy.split(':')
        sort[parts[0]] = parts[1] === 'desc' ? -1 : 1
    }

    try {
        const config = await Config.findById(req.query.config)

        if (!config) {
            return res.status(404).send() 
        }

        await config.populate({
            path: 'configStrategy',
            options: {
                limit: parseInt(req.query.limit),
                skip: parseInt(req.query.skip),
                sort
            }
        }).execPopulate()

        let configStrategies = config.configStrategy;

        configStrategies = await verifyOwnership(req.admin, configStrategies, config.domain, ActionTypes.READ, RouterTypes.STRATEGY)

        res.send(configStrategies)
    } catch (e) {
        responseException(res, e, 500)
    }
})

router.get('/configstrategy/:id', auth, async (req, res) => {
    try {
        let configStrategy = await ConfigStrategy.findById(req.params.id)

        if (!configStrategy) {
            return res.status(404).send()
        }

        configStrategy = await verifyOwnership(req.admin, configStrategy, configStrategy.domain, ActionTypes.READ, RouterTypes.STRATEGY)

        res.send(configStrategy)
    } catch (e) {
        responseException(res, e, 500)
    }
})

// GET /configstrategy/ID?sortBy=createdAt:desc
// GET /configstrategy/ID?limit=10&skip=20
// GET /configstrategy/ID
router.get('/configstrategy/history/:id', auth, async (req, res) => {
    const sort = {}

    if (req.query.sortBy) {
        const parts = req.query.sortBy.split(':')
        sort[`${parts[0]}.${parts[1]}`] = parts[2] === 'desc' ? -1 : 1
    }

    try {
        const configStrategy = await ConfigStrategy.findOne({ _id: req.params.id })

        if (!configStrategy) {
            return res.status(404).send()
        }

        await configStrategy.populate({
            path: 'history',
            select: 'oldValue newValue -_id',
            options: {
                limit: parseInt(req.query.limit),
                skip: parseInt(req.query.skip),
                sort
            }
        }).execPopulate()

        let history = configStrategy.history;

        history = await verifyOwnership(req.admin, history, configStrategy.domain, ActionTypes.READ, RouterTypes.STRATEGY)

        res.send(history)
    } catch (e) {
        responseException(res, e, 500)
    }
})

router.get('/configstrategy/req/:strategy', auth, (req, res) => {
    try {
        const result = strategyRequirements(req.params.strategy, res)
        res.send(result)
    } catch (e) {
        responseException(res, e, 500)
    }
})

router.delete('/configstrategy/:id', auth, async (req, res) => {
    try {
        let configStrategy = await ConfigStrategy.findById(req.params.id)

        if (!configStrategy) {
            return res.status(404).send()
        }

        configStrategy = await verifyOwnership(req.admin, configStrategy, configStrategy.domain, ActionTypes.DELETE, RouterTypes.STRATEGY)

        await configStrategy.remove()
        res.send(configStrategy)
    } catch (e) {
        responseException(res, e, 500)
    }
})

router.patch('/configstrategy/:id', auth, 
    verifyInputUpdateParameters(['description', 'values', 'operation']), async (req, res) => {
    try {
        let configStrategy = await ConfigStrategy.findById(req.params.id)
            
        if (!configStrategy) {
            return res.status(404).send()
        }

        configStrategy = await verifyOwnership(req.admin, configStrategy, configStrategy.domain, ActionTypes.UPDATE, RouterTypes.STRATEGY)

        req.updates.forEach((update) => configStrategy[update] = req.body[update])
        await configStrategy.save()
        res.send(configStrategy)
    } catch (e) {
        responseException(res, e, 400)
    }
})

router.patch('/configstrategy/addval/:id', auth,
    verifyInputUpdateParameters(['value']), async (req, res) => {
    try {
        let configStrategy = await ConfigStrategy.findById(req.params.id)
        
        if (!configStrategy) {
            return res.status(404).send()
        }

        if (!req.body.value) {
            return res.status(400).send({ error: 'The attribute \'value\' must be assigned' })
        }

        const value = req.body.value.trim()
        const foundExistingOne = configStrategy.values.find((element) => element === value)

        if (foundExistingOne) {
            return res.status(400).send({ error: `Value '${value}' already exist` })
        }

        configStrategy = await verifyOwnership(req.admin, configStrategy, configStrategy.domain, ActionTypes.UPDATE, RouterTypes.STRATEGY)

        configStrategy.values.push(value)
        await configStrategy.save()
        res.send(configStrategy)
    } catch (e) {
        responseException(res, e, 400)
    }
})

router.patch('/configstrategy/updateval/:id', auth,
    verifyInputUpdateParameters(['oldvalue', 'newvalue']), async (req, res) => {
    try {
        let configStrategy = await ConfigStrategy.findById(req.params.id)
            
        if (!configStrategy) {
            return res.status(404).send()
        }

        if (!req.body.oldvalue || !req.body.newvalue) {
            return res.status(400).send({ error: 'Attributes \'oldvalue\' and \'newvalue\' must be assigned' })
        }

        const oldvalue = req.body.oldvalue.trim()
        const indexOldValue = configStrategy.values.indexOf(oldvalue)

        if (indexOldValue < 0) {
            return res.status(404).send({ error: `Old value '${oldvalue}' not found` })
        }

        const newvalue = req.body.newvalue.trim()
        const indexNewValue = configStrategy.values.indexOf(newvalue)

        if (indexNewValue >= 0) {
            return res.status(400).send({ error: `Value '${newvalue}' already exist` })
        }

        configStrategy = await verifyOwnership(req.admin, configStrategy, configStrategy.domain, ActionTypes.UPDATE, RouterTypes.STRATEGY)

        configStrategy.values.splice(indexOldValue)
        configStrategy.values.push(newvalue)
        await configStrategy.save()
        res.send(configStrategy)
    } catch (e) {
        responseException(res, e, 400)
    }
})

router.patch('/configstrategy/removeval/:id', auth,
    verifyInputUpdateParameters(['value']),  async (req, res) => {
    try {
        let configStrategy = await ConfigStrategy.findById(req.params.id)
            
        if (!configStrategy) {
            return res.status(404).send()
        }

        if (!req.body.value) {
            return res.status(400).send({ error: 'The attribute \'value\' must be assigned' })
        }

        const value = req.body.value.trim()
        const indexValue = configStrategy.values.indexOf(value)

        if (indexValue < 0) {
            return res.status(404).send({ error: `Value '${value}' does not exist` })
        }

        configStrategy = await verifyOwnership(req.admin, configStrategy, configStrategy.domain, ActionTypes.UPDATE, RouterTypes.STRATEGY)

        configStrategy.values.splice(indexValue)
        await configStrategy.save()
        res.send(configStrategy)
    } catch (e) {
        responseException(res, e, 400)
    }
})

// GET /configstrategy/values:id?sort=true
// GET /configstrategy/values:id?limit=10&skip=20
router.get('/configstrategy/values/:id', auth, async (req, res) => {
    try {
        const configStrategy = await ConfigStrategy.findById(req.params.id)

        if (!configStrategy) {
            return res.status(404).send() 
        }
        
        let values = configStrategy.values
        if (req.query.sort === 'true') {
            values.sort()
        }

        if (req.query.limit) {
            values = values.slice(req.query.skip, req.query.limit)
        } else if (req.query.skip) {
            values = values.slice(req.query.skip, values.length)
        }

        values = await verifyOwnership(req.admin, values, configStrategy.domain, ActionTypes.READ, RouterTypes.STRATEGY)

        res.send(values)
    } catch (e) {
        responseException(res, e, 500)
    }
})

router.patch('/configstrategy/updateStatus/:id', auth, async (req, res) => {
    try {
        let configStrategy = await ConfigStrategy.findById(req.params.id)
        
        if (!configStrategy) {
            return res.status(404).send({ error: 'Strategy does not exist'})
        }

        configStrategy = await verifyOwnership(req.admin, configStrategy, configStrategy.domain, ActionTypes.UPDATE, RouterTypes.STRATEGY)

        const updates = await checkEnvironmentStatusChange(req, res, configStrategy.domain)
        
        updates.forEach((update) => configStrategy.activated.set(update, req.body[update]))
        await configStrategy.save()
        res.send(configStrategy)
    } catch (e) {
        responseException(res, e, 400)
    }
})

router.patch('/configstrategy/removeStatus/:id', auth, async (req, res) => {
    try {
        let configStrategy = await ConfigStrategy.findById(req.params.id)
        
        if (!configStrategy) {
            return res.status(404).send({ error: 'Strategy does not exist'})
        }

        configStrategy = await verifyOwnership(req.admin, configStrategy, configStrategy.domain, ActionTypes.UPDATE, RouterTypes.STRATEGY)

        res.send(await removeConfigStrategyStatus(configStrategy, req.body.env))
    } catch (e) {
        responseException(res, e, 400)
    }
})

export default router;