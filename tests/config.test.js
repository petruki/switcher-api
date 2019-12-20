import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app';
import Admin from '../src/models/admin';
import Domain from '../src/models/domain';
import GroupConfig from '../src/models/group-config';
import Config from '../src/models/config';
import History from '../src/models/history';
import { EnvType } from '../src/models/environment';
import { ConfigStrategy } from '../src/models/config-strategy';
import { 
    setupDatabase,
    adminMasterAccountId,
    adminMasterAccount,
    adminAccount,
    domainId,
    groupConfigId,
    configId1,
    config1Document,
    configId2,
    configStrategyId
 } from './fixtures/db_api';

afterAll(async () => { 
    await new Promise(resolve => setTimeout(resolve, 1000));
    await mongoose.disconnect()
})

describe('Testing configuration insertion', () => {
    beforeAll(setupDatabase)

    test('CONFIG_SUITE - Should create a new Config', async () => {
        const response = await request(app)
            .post('/config/create')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                key: 'NEW_CONFIG',
                description: 'Description of my new Config',
                group: groupConfigId
            }).expect(201)

        // DB validation - document created
        const config = await Config.findById(response.body._id)
        expect(config).not.toBeNull()

        // Response validation
        expect(response.body.key).toBe('NEW_CONFIG')
    })

    test('CONFIG_SUITE - Should not create a new Config - with wrong group config Id', async () => {
        const response = await request(app)
            .post('/config/create')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                key: 'NEW_CONFIG',
                description: 'Description of my new Config',
                domain: new mongoose.Types.ObjectId()
            }).expect(404)

        expect(response.body.error).toBe('Group Config not found')
    })
})

describe('Testing fetch configuration info', () => {
    beforeAll(setupDatabase)

    test('CONFIG_SUITE - Should get Config information', async () => {
        let response = await request(app)
            .get('/config?group=' + groupConfigId)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send().expect(200)

        expect(response.body.length).toEqual(2)

        expect(String(response.body[0]._id)).toEqual(String(config1Document._id))
        expect(response.body[0].key).toEqual(config1Document.key)
        expect(String(response.body[0].owner)).toEqual(String(config1Document.owner))
        expect(response.body[0].activated[EnvType.DEFAULT]).toEqual(config1Document.activated.get(EnvType.DEFAULT))

        // Adding new Config
        response = await request(app)
            .post('/config/create')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                key: 'NEW_CONFIG123',
                description: 'Description of my new Config',
                group: groupConfigId
            }).expect(201)

        // DB validation - document created
        const config = await Config.findById(response.body._id)
        expect(config).not.toBeNull()

        response = await request(app)
            .get('/config?group=' + groupConfigId)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send().expect(200)

        expect(response.body.length).toEqual(3)
    })

    test('CONFIG_SUITE - Should get Config information by Id', async () => {
        let response = await request(app)
            .get('/config/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send().expect(200)

        expect(String(response.body._id)).toEqual(String(config1Document._id))
        expect(response.body.key).toEqual(config1Document.key)
        expect(String(response.body.group)).toEqual(String(config1Document.group))
        expect(response.body.activated[EnvType.DEFAULT]).toEqual(config1Document.activated.get(EnvType.DEFAULT))

        // Adding new Config
        response = await request(app)
            .post('/config/create')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                key: 'NEW_CONFIG456',
                description: 'Description of my new Config',
                group: groupConfigId
            }).expect(201)

        response = await request(app)
            .get('/config/' + response.body._id)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send().expect(200)
    })

    test('CONFIG_SUITE - Should not found Config information by Id', async () => {
        await request(app)
            .get('/config/' + 'NOTEXIST')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send().expect(404)
    })
})

describe('Testing configuration deletion', () => {
    beforeAll(setupDatabase)

    test('CONFIG_SUITE - Should delete Config', async () => {
        // DB validation Before deleting
        let domain = await Domain.findById(domainId)
        expect(domain).not.toBeNull()

        let group = await GroupConfig.findById(groupConfigId)
        expect(group).not.toBeNull()

        let config1 = await Config.findById(configId1)
        expect(config1).not.toBeNull()

        let config2 = await Config.findById(configId2)
        expect(config2).not.toBeNull()

        let configStrategy = await ConfigStrategy.findById(configStrategyId)
        expect(configStrategy).not.toBeNull()

        await request(app)
            .delete('/config/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send().expect(200)

        const admin = await Admin.findById(adminMasterAccountId)
        expect(admin).not.toBeNull()

        // DB validation After - Verify deleted dependencies
        domain = await Domain.findById(domainId)
        expect(domain).not.toBeNull()

        group = await GroupConfig.findById(groupConfigId)
        expect(group).not.toBeNull()

        config1 = await Config.findById(configId1)
        expect(config1).toBeNull()

        config2 = await Config.findById(configId2)
        expect(config2).not.toBeNull()

        configStrategy = await ConfigStrategy.findById(configStrategyId)
        expect(configStrategy).toBeNull()
    })
})

describe('Testing update info', () => {
    beforeAll(setupDatabase)

    test('CONFIG_SUITE - Should update Config info', async () => {

        let config = await Config.findById(configId1)
        expect(config).not.toBeNull()

        await request(app)
            .patch('/config/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                key: 'NEWKEY',
                description: 'New description'
            }).expect(200)
        
        // DB validation - verify flag updated
        config = await Config.findById(configId1)
        expect(config).not.toBeNull()
        expect(config.key).toEqual('NEWKEY')
        expect(config.description).toEqual('New description')
    })

    test('CONFIG_SUITE - Should not update Config info', async () => {
        await request(app)
        .patch('/config/' + configId1)
        .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
        .send({
            activated: false,
            owner: 'I_SHOULD_NOT_UPDATE_THIS'
        }).expect(400)
    })

    test('CONFIG_SUITE - Should update Config environment status - default', async () => {
        expect(config1Document.activated.get(EnvType.DEFAULT)).toEqual(true);

        const response = await request(app)
            .patch('/config/updateStatus/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                default: false
            }).expect(200);

        expect(response.body.activated[EnvType.DEFAULT]).toEqual(false);

        // DB validation - verify status updated
        const config = await Config.findById(configId1)
        expect(config.activated.get(EnvType.DEFAULT)).toEqual(false);
    })
})

describe('Testing Environment status change', () => {
    beforeAll(setupDatabase)

    test('CONFIG_SUITE - Should update Config environment status - QA', async () => {
        // QA Environment still does not exist
        expect(config1Document.activated.get('QA')).toEqual(undefined);

        // Creating QA Environment...
        await request(app)
            .post('/environment/create')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                name: 'QA',
                domain: domainId
            }).expect(201)

        const response = await request(app)
            .patch('/config/updateStatus/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                QA: true
            }).expect(200);

        expect(response.body.activated['QA']).toEqual(true);

        // DB validation - verify status updated
        let config = await Config.findById(configId1)
        expect(config.activated.get(EnvType.DEFAULT)).toEqual(true);
        expect(config.activated.get('QA')).toEqual(true);

        // Inactivating QA. Default environment should stay activated
        await request(app)
            .patch('/config/updateStatus/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                QA: false
            }).expect(200);

        config = await Config.findById(configId1)
        expect(config.activated.get(EnvType.DEFAULT)).toEqual(true);
        expect(config.activated.get('QA')).toEqual(false);
    })

    test('CONFIG_SUITE - Should NOT update Config environment status - Permission denied', async () => {
        await request(app)
            .patch('/config/updateStatus/' + configId1)
            .set('Authorization', `Bearer ${adminAccount.tokens[0].token}`)
            .send({
                default: false
            }).expect(400);
    })

    test('CONFIG_SUITE - Should NOT update Config environment status - Config not fould', async () => {
        await request(app)
            .patch('/config/updateStatus/FAKE_CONFIG')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                default: false
            }).expect(400);
    })

    test('CONFIG_SUITE - Should NOT update Config environment status - Config not fould', async () => {
        const response = await request(app)
            .patch('/config/updateStatus/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                UNKNOWN_ENVIRONMENT: false
            }).expect(400);
            
        expect(response.body.error).toEqual('Invalid updates');
    })

    test('CONFIG_SUITE - Should remove Config environment status', async () => {
        // Creating QA1 Environment...
        await request(app)
            .post('/environment/create')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                name: 'QA1',
                domain: domainId
            }).expect(201)
        
        await request(app)
            .patch('/config/updateStatus/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                QA1: true
            }).expect(200);

        let config = await Config.findById(configId1)
        expect(config.activated.get('QA1')).toEqual(true);

        await request(app)
            .patch('/config/removeStatus/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                env: 'QA1'
            }).expect(200);

        // DB validation - verify status updated
        config = await Config.findById(configId1)
        expect(config.activated.get('QA1')).toEqual(undefined);
    })

    test('CONFIG_SUITE - Should record changes on history collection', async () => {
        let response = await request(app)
            .post('/config/create')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                key: 'TEST_HIST_RECORD',
                description: 'Description of my new Config',
                group: groupConfigId
            }).expect(201)
        
        const configId = response.body._id
        response = await request(app)
                .get('/config/history/' + configId)
                .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
                .send().expect(200)
        
        expect(response.body).toEqual([])

        await request(app)
            .patch('/config/' + configId)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                description: 'New description'
            }).expect(200)

        response = await request(app)
            .get('/config/history/' + configId)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send().expect(200)

        expect(response.body).not.toEqual([])

        // DB validation
        let history = await History.find({ elementId: configId })
        expect(history[0].oldValue.get('description')).toEqual('Description of my new Config')
        expect(history[0].newValue.get('description')).toEqual('New description')

        await request(app)
            .patch('/config/updateStatus/' + configId)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                default: false
            }).expect(200);
        
        // DB validation
        history = await History.find({ elementId: configId })
        expect(history.length).toEqual(2)
    })

    test('CONFIG_SUITE - Should NOT remove Config environment status', async () => {
        // Creating QA3 Environment...
        await request(app)
            .post('/environment/create')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                name: 'QA3',
                domain: domainId
            }).expect(201)

        await request(app)
            .patch('/config/updateStatus/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                QA3: true
            }).expect(200);

        // default environment cannot be removed
        await request(app)
            .patch('/config/removeStatus/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                env: EnvType.DEFAULT
            }).expect(400);
        
        // QA3 environment cannot be removed without permission
        await request(app)
            .patch('/config/removeStatus/' + configId1)
            .set('Authorization', `Bearer ${adminAccount.tokens[0].token}`)
            .send({
                env: 'QA3'
            }).expect(400);

        // Config does not exist
        await request(app)
            .patch('/config/removeStatus/FAKE_CONFIG')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                env: 'QA3'
            }).expect(400);

        const config = await Config.findById(configId1)
        expect(config.activated.get(EnvType.DEFAULT)).toEqual(true);
        expect(config.activated.get('QA3')).toEqual(true);
    })
})

describe('Testing component association', () => {
    beforeAll(async () => {
        await request(app)
            .post('/component/create')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                name: 'my-web-app-for-my-config',
                description: 'This is my Web App using this wonderful API',
                domain: domainId
            }).expect(201)
    })

    test('CONFIG_SUITE - Should associate component to a config', async () => {
        await request(app)
            .patch('/config/addComponent/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                component: "my-web-app-for-my-config"
            }).expect(200)

        // DB validation - document updated
        const config = await Config.findById(configId1)
        const component = config.components.filter(element => element === 'my-web-app-for-my-config')
        expect(component[0]).toBe('my-web-app-for-my-config')
    })

    test('CONFIG_SUITE - Should NOT associate component to a config - Component not found', async () => {
        const response = await request(app)
            .patch('/config/addComponent/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                component: "i-do-not-exist"
            }).expect(404)
        
        expect(response.body.error).toBe('Component i-do-not-exist not found')
    })

    test('CONFIG_SUITE - Should NOT associate component to a config - Config not found', async () => {
        await request(app)
            .patch('/config/addComponent/NOW_I-AM-NOT-EXIST')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                component: "my-web-app-for-my-config"
            }).expect(404)
    })

    test('CONFIG_SUITE - Should NOT desassociate component from a config - Component not found', async () => {
        await request(app)
            .patch('/config/removeComponent/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                component: "i-do-not-exist"
            }).expect(404)
    })

    test('CONFIG_SUITE - Should NOT desassociate component from a config - Config not found', async () => {
        await request(app)
            .patch('/config/removeComponent/NOW_I-AM-NOT-EXIST')
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                component: "my-web-app-for-my-config"
            }).expect(404)
    })

    test('CONFIG_SUITE - Should desassociate component from a config', async () => {
        await request(app)
            .patch('/config/removeComponent/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send({
                component: "my-web-app-for-my-config"
            }).expect(200)

        // DB validation - document updated
        const config = await Config.findById(configId1)
        expect(config.components.length).toEqual(0)
    })

    test('STRATEGY_SUITE - Should remove records from history after deleting element', async () => {
        let history = await History.find({ elementId: configId1 })
        expect(history.length > 0).toEqual(true)
        await request(app)
            .delete('/config/' + configId1)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send().expect(200)

        history = await History.find({ elementId: configId1 })
        expect(history.length).toEqual(0)
    })
})