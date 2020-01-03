import mongoose from 'mongoose';
import moment from 'moment';
import History from './history';
import { ConfigStrategy } from './config-strategy';
import { EnvType } from './environment';
import { recordHistory } from './common/index'

const configSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    activated: {
        type: Map,
        of: Boolean,
        required: true,
        default: new Map().set(EnvType.DEFAULT, true)
    },
    components: [{
        type: mongoose.Schema.Types.ObjectId
    }],
    group: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'GroupConfig'
    },
    domain: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Domain'
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Admin'
    }
}, {
    timestamps: true
})

configSchema.virtual('history', {
    ref: 'History',
    localField: '_id',
    foreignField: 'elementId'
})

configSchema.options.toJSON = {
    getters: true,
    virtuals: true,
    minimize: false,
    transform: function (doc, ret, options) {
        if (ret.updatedAt || ret.createdAt) {
            ret.updatedAt = moment(ret.updatedAt).format('YYYY-MM-DD HH:mm:ss')
            ret.createdAt = moment(ret.createdAt).format('YYYY-MM-DD HH:mm:ss')
        }
        return ret
    }
}

async function recordConfigHistory(config, modifiedField) {
    if (config.__v !== undefined && modifiedField.length) {
        const oldConfig = await Config.findById(config._id).select(modifiedField);
        recordHistory(modifiedField, oldConfig, config)
    }
}

configSchema.virtual('configStrategy', {
    ref: 'ConfigStrategy',
    localField: '_id',
    foreignField: 'config'
})

configSchema.pre('remove', async function (next) {
    const config = this
    await ConfigStrategy.deleteMany({ config: config._id })

    const history = await History.find({ elementId: config._id })
    if (history) {
        history.forEach((h) => h.remove())
    }

    next()
})

configSchema.pre('save', async function (next) {
    const config = this
    await recordConfigHistory(config, this.modifiedPaths());
    next()
})

const Config = mongoose.model('Config', configSchema)

export default Config;