import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app';
import Domain from '../src/models/domain';
import GroupConfig from '../src/models/group-config';
import Config from '../src/models/config';
import { ConfigStrategy, StrategiesType, OperationsType } from '../src/models/config-strategy';
import { 
    setupDatabase,
    adminMasterAccount,
    apiKey,
    keyConfig,
    configId,
    groupConfigId,
    domainId,
    domainDocument,
    configStrategyUSERId,
    component1
} from './fixtures/db_client';
import { EnvType } from '../src/models/environment';

const changeStrategy = async (strategyId, newOperation, status, environment) => {
    const strategy = await ConfigStrategy.findById(strategyId)
    strategy.operation = newOperation ? newOperation : strategy.operation
    strategy.activated.set(environment, status !== undefined ? status : strategy.activated.get(environment))
    await strategy.save()
}

const changeConfigStatus = async (configId, status, environment) => {
    const config = await Config.findById(configId)
    config.activated.set(environment, status !== undefined ? status : config.activated.get(environment))
    await config.save()
}

const changeGroupConfigStatus = async (groupConfigId, status, environment) => {
    const groupConfig = await GroupConfig.findById(groupConfigId)
    groupConfig.activated.set(environment, status !== undefined ? status : groupConfig.activated.get(environment))
    await groupConfig.save()
}

const changeDomainStatus = async (domainId, status, environment) => {
    const domain = await Domain.findById(domainId)
    domain.activated.set(environment, status !== undefined ? status : domain.activated.get(environment))
    await domain.save()
}

beforeAll(setupDatabase)

afterAll(async () => { 
    await new Promise(resolve => setTimeout(resolve, 1000));
    await mongoose.disconnect()
})

describe("Testing criteria [GraphQL] ", () => {
    let token

    beforeAll(async () => {
        const response = await request(app)
            .post('/criteria/auth')
            .set('switcher-api-key', `${apiKey}`)
            .send({
                domain: domainDocument.name,
                component: component1.name,
                environment: EnvType.DEFAULT
            }).expect(200)

        token = response.body.token
    })

    afterAll(setupDatabase)

    test('CLIENT_SUITE - Should return success on a simple CRITERIA response', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    criteria(
                        key: "${keyConfig}", 
                        entry: [{ strategy: "${StrategiesType.VALUE}", input: "USER_1" },
                                { strategy: "${StrategiesType.NETWORK}", input: "10.0.0.3" }]
                        ) { response { result reason } }
                }  
            `})
            .expect(200)
            .end((err, res) => {
                const expected = `
                    {
                        "data": { "criteria": { "response": { "result": true, "reason": "Success" } } }
                    }`;
                
                expect(JSON.parse(res.text)).toMatchObject(JSON.parse(expected));
                done();
            })
    })

    test('CLIENT_SUITE - Should return success on Flat view resolved by Group name', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    configuration(group: "Group Test") {
                        domain { name description activated }
                        group { name description activated }
                        config { key description activated }
                        strategies { strategy activated operation values }
                    }
                }  
            `})
            .expect(200)
            .end((err, res) => {
                const expected = `
                {"data":{"configuration":{"domain":{"name":"Domain","description":"Test Domain","activated":true},"group":[{"name":"Group Test","description":"Test Group","activated":true}],"config":[{"key":"TEST_CONFIG_KEY","description":"Test config 1","activated":true},{"key":"TEST_CONFIG_KEY_PRD_QA","description":"Test config 2 - Off in PRD and ON in QA","activated":false}],"strategies":null}}}`;
                
                expect(JSON.parse(res.text)).toMatchObject(JSON.parse(expected));
                done();
            })
    })

    test('CLIENT_SUITE - Should NOT return on Flat view resolved by an unknown Group name', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    configuration(group: "UNKNOWN GROUP NAME") {
                        domain { name description activated }
                        group { name description activated }
                        config { key description activated }
                        strategies { strategy activated operation values }
                    }
                }  
            `})
            .expect(200)
            .end((err, res) => {
                expect(JSON.parse(res.text).data.configuration).toEqual(null);
                done();
            })
    })

    test('CLIENT_SUITE - Should return success on Flat view resolved by Config Key', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    configuration(key: "${keyConfig}") {
                        domain { name description activated }
                        group { name description activated }
                        config { key description activated }
                        strategies { strategy activated operation values }
                    }
                }  
            `})
            .expect(200)
            .end((err, res) => {
                const expected = `
                {"data":{"configuration":{"domain":{"name":"Domain","description":"Test Domain","activated":true},"group":[{"name":"Group Test","description":"Test Group","activated":true}],"config":[{"key":"TEST_CONFIG_KEY","description":"Test config 1","activated":true}],"strategies":[{"strategy":"VALUE_VALIDATION","activated":true,"operation":"EXIST","values":["USER_1","USER_2","USER_3"]},{"strategy":"NETWORK_VALIDATION","activated":true,"operation":"EXIST","values":["10.0.0.0/24"]},{"strategy":"TIME_VALIDATION","activated":false,"operation":"BETWEEN","values":["13:00","14:00"]},{"strategy":"DATE_VALIDATION","activated":false,"operation":"GREATER","values":["2019-12-01T13:00"]}]}}}`;
                
                expect(JSON.parse(res.text)).toMatchObject(JSON.parse(expected));
                done();
            })
    })

    test('CLIENT_SUITE - Should NOT return on Flat view resolved by an unknown Config Key', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    configuration(key: "UNKNOWN_CONFIG_KEY") {
                        domain { name description activated }
                        group { name description activated }
                        config { key description activated }
                        strategies { strategy activated operation values }
                    }
                }  
            `})
            .expect(200)
            .end((err, res) => {
                expect(JSON.parse(res.text).data.configuration).toEqual(null);
                done();
            })
    })

    test('CLIENT_SUITE - Should NOT return success on a simple CRITERIA response - Bad login input', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    criteria(
                        key: "${keyConfig}", 
                        entry: [{ strategy: "${StrategiesType.VALUE}", input: "USER_4" },
                                { strategy: "${StrategiesType.NETWORK}", input: "10.0.0.3" }]
                        ) { response { result reason } }
                }  
            `})
            .expect(200)
            .end((err, res) => {
                const expected = `
                    {
                        "data": { "criteria": { "response": { "result": false, "reason": "Strategy '${StrategiesType.VALUE}' does not agree" } } }
                    }`;
                
                expect(JSON.parse(res.text)).toMatchObject(JSON.parse(expected));
                done();
            })
    })

    test('CLIENT_SUITE - Should NOT return success on a simple CRITERIA response - Missing input', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    criteria(
                        key: "${keyConfig}", 
                        entry: [{ strategy: "${StrategiesType.VALUE}", input: "USER_2" }]
                        ) { response { result reason } }
                }  
            `})
            .expect(200)
            .end((err, res) => {
                const expected = `
                    {
                        "data": { "criteria": { "response": { "result": false, "reason": "Strategy '${StrategiesType.NETWORK}' did not receive any input" } } }
                    }`;
                
                expect(JSON.parse(res.text)).toMatchObject(JSON.parse(expected));
                done();
            })
    })

    test('CLIENT_SUITE - Should NOT return success on a simple CRITERIA response - Invalid KEY', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    criteria(
                        key: "INVALID_KEY", 
                        entry: [{ strategy: "${StrategiesType.VALUE}", input: "USER_1" },
                                { strategy: "${StrategiesType.NETWORK}", input: "10.0.0.3" }]
                        ) { response { result reason } }
                } 
            `})
            .expect(200)
            .end((err, res) => {
                expect(JSON.parse(res.text).data.criteria).toEqual(null);
                done();
            })
    })

    test('CLIENT_SUITE - Should return config disabled for PRD environment while activated in QA', async () => {
        // Config enabled
        const response = await request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    criteria(
                        key: "${keyConfig}", 
                        entry: [{ strategy: "${StrategiesType.VALUE}", input: "USER_1" },
                                { strategy: "${StrategiesType.NETWORK}", input: "10.0.0.3" }]
                        ) { response { result reason } }
                }  
            `})
            .expect(200);

        let expected = `
            {
                "data": { "criteria": { "response": { "result": true, "reason": "Success" } } }
            }`;
        
        expect(JSON.parse(response.text)).toMatchObject(JSON.parse(expected));
    })

    test('CLIENT_SUITE - It will be deactivated on default environment', async () => {
        await changeConfigStatus(configId, false, EnvType.DEFAULT)
        const response = await request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    criteria(
                        key: "${keyConfig}", 
                        entry: [{ strategy: "${StrategiesType.VALUE}", input: "USER_1" },
                                { strategy: "${StrategiesType.NETWORK}", input: "10.0.0.3" }]
                        ) { response { result reason } }
                }  
            `})
            .expect(200);

        const expected = `
            {
                "data": { "criteria": { "response": { "result": false, "reason": "Config disabled" } } }
            }`;
        
        expect(JSON.parse(response.text)).toMatchObject(JSON.parse(expected));
    })

    test('CLIENT_SUITE - It will be activated on QA environment', async () => {
        let qaToken
        const responseToken = await request(app)
            .post('/criteria/auth')
            .set('switcher-api-key', `${apiKey}`)
            .send({
                domain: domainDocument.name,
                component: component1.name,
                environment: 'QA'
            }).expect(200)
        qaToken = responseToken.body.token

        await changeConfigStatus(configId, true, 'QA');
        const response = await request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${qaToken}`)
            .send({ query: `
                {
                    criteria(
                        key: "${keyConfig}", 
                        entry: [{ strategy: "${StrategiesType.VALUE}", input: "USER_1" },
                                { strategy: "${StrategiesType.NETWORK}", input: "10.0.0.3" }]
                        ) { response { result reason } }
                }  
            `})
            .expect(200);

        const expected = `
            {
                "data": { "criteria": { "response": { "result": true, "reason": "Success" } } }
            }`;
        
        expect(JSON.parse(response.text)).toMatchObject(JSON.parse(expected));
    })

    test('CLIENT_SUITE - Should return false after changing strategy operation', async () => {
        let qaToken
        const responseToken = await request(app)
            .post('/criteria/auth')
            .set('switcher-api-key', `${apiKey}`)
            .send({
                domain: domainDocument.name,
                component: component1.name,
                environment: 'QA'
            }).expect(200)
        qaToken = responseToken.body.token

        await changeStrategy(configStrategyUSERId, OperationsType.NOT_EXIST, true, 'QA')
        await changeStrategy(configStrategyUSERId, undefined, false, EnvType.DEFAULT)
        const response = await request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${qaToken}`)
            .send({ query: `
                {
                    criteria(
                        key: "${keyConfig}", 
                        entry: [{ strategy: "${StrategiesType.VALUE}", input: "USER_1" },
                                { strategy: "${StrategiesType.NETWORK}", input: "10.0.0.3" }]
                        ) { response { result reason } }
                }  
            `})
            .expect(200);

        const expected = `
            {
                "data": { "criteria": { "response": { "result": false, "reason": "Strategy '${StrategiesType.VALUE}' does not agree" } } }
            }`;
        
        expect(JSON.parse(response.text)).toMatchObject(JSON.parse(expected));
    })

    test('CLIENT_SUITE - Should return success for default environment now, since the strategy has started being specific for QA environment', async () => {
        await changeConfigStatus(configId, true, EnvType.DEFAULT);
        const response = await request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    criteria(
                        key: "${keyConfig}", 
                        entry: [{ strategy: "${StrategiesType.VALUE}", input: "USER_1" },
                                { strategy: "${StrategiesType.NETWORK}", input: "10.0.0.3" }]
                        ) { response { result reason } }
                }  
            `})
            .expect(200);

        const expected = `
            {
                "data": { "criteria": { "response": { "result": true, "reason": "Success" } } }
            }`;
        
        expect(JSON.parse(response.text)).toMatchObject(JSON.parse(expected));
    })

    test('CLIENT_SUITE - Should return false due to Group deactivation', async () => {
        await changeGroupConfigStatus(groupConfigId, false, EnvType.DEFAULT)
        const response = await request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    criteria(
                        key: "${keyConfig}", 
                        entry: [{ strategy: "${StrategiesType.VALUE}", input: "USER_1" },
                                { strategy: "${StrategiesType.NETWORK}", input: "10.0.0.3" }]
                        ) { response { result reason } }
                }  
            `})
            .expect(200);

        const expected = `
            {
                "data": { "criteria": { "response": { "result": false, "reason": "Group disabled" } } }
            }`;
        
        expect(JSON.parse(response.text)).toMatchObject(JSON.parse(expected));
    })

    test('CLIENT_SUITE - Should return false due to Domain deactivation', async () => {
        await changeGroupConfigStatus(groupConfigId, true, EnvType.DEFAULT)
        await changeDomainStatus(domainId, false, EnvType.DEFAULT)
        const response = await request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    criteria(
                        key: "${keyConfig}", 
                        entry: [{ strategy: "${StrategiesType.VALUE}", input: "USER_1" },
                                { strategy: "${StrategiesType.NETWORK}", input: "10.0.0.3" }]
                        ) { response { result reason } }
                }  
            `})
            .expect(200);

        const expected = `
            {
                "data": { "criteria": { "response": { "result": false, "reason": "Domain disabled" } } }
            }`;
        
        expect(JSON.parse(response.text)).toMatchObject(JSON.parse(expected));
    })
})

describe("Testing domain", () => {
    let token

    beforeAll(async () => {
        const response = await request(app)
            .post('/criteria/auth')
            .set('switcher-api-key', `${apiKey}`)
            .send({
                domain: domainDocument.name,
                component: component1.name,
                environment: EnvType.DEFAULT
            }).expect(200)

        token = response.body.token
    })

    afterAll(setupDatabase)

    test('CLIENT_SUITE - Should return the Domain structure', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    domain(name: "Domain") { name description activated
                        group(activated: true) { name description activated
                            config(activated: true) { key description activated
                                strategies(activated: true) { strategy activated operation  values }
                            }
                        }
                    }
                }
            `})
            .expect(200)
            .end((err, res) => {
                const expected = `
                        {
                            "data":{
                               "domain":
                                  {
                                     "name":"Domain",
                                     "description":"Test Domain",
                                     "activated":true,
                                     "group":[
                                        {
                                           "name":"Group Test",
                                           "description":"Test Group",
                                           "activated":true,
                                           "config":[
                                              {
                                                 "key":"TEST_CONFIG_KEY",
                                                 "description":"Test config 1",
                                                 "activated":true,
                                                 "strategies":[
                                                    {
                                                       "strategy":"VALUE_VALIDATION",
                                                       "activated":true,
                                                       "operation":"EXIST",
                                                       "values":[
                                                          "USER_1",
                                                          "USER_2",
                                                          "USER_3"
                                                       ]
                                                    },
                                                    {
                                                       "strategy":"NETWORK_VALIDATION",
                                                       "activated":true,
                                                       "operation":"EXIST",
                                                       "values":[
                                                          "10.0.0.0/24"
                                                       ]
                                                    }
                                                 ]
                                              }
                                           ]
                                        }
                                     ]
                                  }
                            }
                        }`;
                
                expect(JSON.parse(res.text)).toMatchObject(JSON.parse(expected));
                done();
            })
    })

    test('CLIENT_SUITE - Should return the Domain structure - Disabling strategies (resolver test)', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    domain(name: "Domain") { name description activated
                        group(activated: true) { name description activated
                            config(activated: true) { key description activated
                                strategies(activated: false) { strategy activated operation values }
                            }
                        }
                    }
                }
            `})
            .expect(200)
            .end((err, res) => {
                const expected = `
                        {
                            "data":{
                               "domain":
                                  {
                                     "name":"Domain",
                                     "description":"Test Domain",
                                     "activated":true,
                                     "group":[
                                        {
                                           "name":"Group Test",
                                           "description":"Test Group",
                                           "activated":true,
                                           "config":[
                                              {
                                                 "key":"TEST_CONFIG_KEY",
                                                 "description":"Test config 1",
                                                 "activated":true,
                                                 "strategies":[
                                                    {
                                                       "strategy":"TIME_VALIDATION",
                                                       "activated":false,
                                                       "operation":"BETWEEN",
                                                       "values":[
                                                          "13:00",
                                                          "14:00"
                                                       ]
                                                    },
                                                    {
                                                       "strategy":"DATE_VALIDATION",
                                                       "activated":false,
                                                       "operation":"GREATER",
                                                       "values":[
                                                           "2019-12-01T13:00"
                                                       ]
                                                    }
                                                 ]
                                              }
                                           ]
                                        }
                                     ]
                                  }
                            }
                        }`;
                    
                expect(JSON.parse(res.text)).toMatchObject(JSON.parse(expected));
                done();
            })
    })

    test('CLIENT_SUITE - Should return the Domain structure - Disabling group config (resolver test)', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    domain(name: "Domain") { name description activated
                        group(activated: false) { name description activated
                            config(activated: false) { key description activated
                                strategies(activated: false) { strategy activated operation values }
                            }
                        }
                    }
                }
            `})
            .expect(200)
            .end((err, res) => {
                const expected = `
                        {
                            "data":
                            {
                               "domain":
                                  {
                                     "name":"Domain",
                                     "description":"Test Domain",
                                     "activated":true,
                                     "group":[]
                                  }
                            }
                         }`;
                
                expect(JSON.parse(res.text)).toMatchObject(JSON.parse(expected));
                done();
            })
    })

    test('CLIENT_SUITE - Should return the Domain structure - Disabling config (resolver test)', (done) => {
        request(app)
            .post('/graphql')
            .set('Authorization', `Bearer ${token}`)
            .send({ query: `
                {
                    domain(name: "Domain") { name description activated
                        group(activated: true) { name description activated
                            config(activated: false) { key description activated
                                strategies(activated: false) { strategy activated operation values }
                            }
                        }
                    }
                }
            `})
            .expect(200)
            .end((err, res) => {
                const expected = `
                        {
                            "data":{
                               "domain":
                                  {
                                     "name":"Domain",
                                     "description":"Test Domain",
                                     "activated":true,
                                     "group":[
                                        {
                                           "name":"Group Test",
                                           "description":"Test Group",
                                           "activated":true,
                                           "config":[]
                                        }
                                     ]
                                  }
                            }
                         }`;
                
                expect(JSON.parse(res.text)).toMatchObject(JSON.parse(expected));
                done();
            })
    })
})

describe("Testing criteria [REST] ", () => {
    let token

    beforeAll(async () => {
        const response = await request(app)
            .post('/criteria/auth')
            .set('switcher-api-key', `${apiKey}`)
            .send({
                domain: domainDocument.name,
                component: component1.name,
                environment: EnvType.DEFAULT
            }).expect(200)

        token = response.body.token
    })

    test('CLIENT_SUITE - Should return success on a simple CRITERIA response', (done) => {
        request(app)
            .post(`/criteria?key=${keyConfig}&showReason=true&showStrategy=true`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                entry: [
                    {
                        strategy: StrategiesType.VALUE,
                        input: 'USER_1'
                    },
                    {
                        strategy: StrategiesType.NETWORK,
                        input: '10.0.0.3'
                    }]})
            .expect(200)
            .end((err, { body }) => {
                expect(body.strategies.length).toEqual(4);
                expect(body.reason).toEqual('Success');
                expect(body.result).toBe(true);
                done();
            })
    })

    test('CLIENT_SUITE - Should NOT return success on a simple CRITERIA response - Bad login input', (done) => {
        request(app)
            .post(`/criteria?key=${keyConfig}&showReason=true`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                entry: [
                    {
                        strategy: StrategiesType.VALUE,
                        input: 'USER_4'
                    },
                    {
                        strategy: StrategiesType.NETWORK,
                        input: '10.0.0.3'
                    }]})
            .expect(200)
            .end((err, { body }) => {
                expect(body.strategies).toBe(undefined)
                expect(body.reason).toEqual(`Strategy '${StrategiesType.VALUE}' does not agree`);
                expect(body.result).toBe(false);
                done();
            })
    })

    test('CLIENT_SUITE - Should NOT return success on a simple CRITERIA response - Invalid KEY', (done) => {
        request(app)
            .post(`/criteria?key=INVALID_KEY&showReason=true`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                entry: [
                    {
                        strategy: StrategiesType.VALUE,
                        input: 'USER_1'
                    },
                    {
                        strategy: StrategiesType.NETWORK,
                        input: '10.0.0.3'
                    }]})
            .expect(404)
            .end((err, RES) => {
                done();
            })
    })

    test('CLIENT_SUITE - Should NOT return due to a API Key change, then it should return after renewing the token', async () => {
        const firstResponse = await request(app)
            .post(`/criteria?key=${keyConfig}&showReason=true&showStrategy=true`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                entry: [
                    {
                        strategy: StrategiesType.VALUE,
                        input: 'USER_1'
                    },
                    {
                        strategy: StrategiesType.NETWORK,
                        input: '10.0.0.3'
                    }]})
            .expect(200)
    
        expect(firstResponse.body.strategies.length).toEqual(4);
        expect(firstResponse.body.reason).toEqual('Success');
        expect(firstResponse.body.result).toBe(true);

        const responseNewApiKey = await request(app)
            .get('/domain/generateApiKey/' + domainId)
            .set('Authorization', `Bearer ${adminMasterAccount.tokens[0].token}`)
            .send().expect(201)

        const secondResponse = await request(app)
            .post(`/criteria?key=${keyConfig}&showReason=true&showStrategy=true`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                entry: [
                    {
                        strategy: StrategiesType.VALUE,
                        input: 'USER_1'
                    },
                    {
                        strategy: StrategiesType.NETWORK,
                        input: '10.0.0.3'
                    }]})
            .expect(401)

        expect(secondResponse.body.error).toEqual('Invalid API token.');

        const responseNewToken = await request(app)
            .post('/criteria/auth')
            .set('switcher-api-key', `${responseNewApiKey.body.apiKey}`)
            .send({
                domain: domainDocument.name,
                component: component1.name,
                environment: EnvType.DEFAULT
            }).expect(200)

        token = responseNewToken.body.token

        await request(app)
            .post(`/criteria?key=${keyConfig}&showReason=true&showStrategy=true`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                entry: [
                    {
                        strategy: StrategiesType.VALUE,
                        input: 'USER_1'
                    },
                    {
                        strategy: StrategiesType.NETWORK,
                        input: '10.0.0.3'
                    }]})
            .expect(200)
        
    })
})