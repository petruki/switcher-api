import mongoose from 'mongoose';
import moment from 'moment';

export const EnvType = Object.freeze({
    DEFAULT: 'default'
});

const environmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        default: EnvType.DEFAULT
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

environmentSchema.options.toJSON = {
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

environmentSchema.pre('validate', async function (next) {
    const { name, domain } = this
    const existEnv = await Environment.findOne({ name, domain })
    
    if (existEnv) {
        const err = new Error(`Unable to complete the operation. Environment '${name}' already exist for this Domain`)
        next(err);
    }

    next()
})

export const Environment = mongoose.model('Environment', environmentSchema)