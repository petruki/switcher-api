import mongoose from 'mongoose';
import moment from 'moment';
import { slackTicketSchema, TicketStatusType } from './slack_ticket';

const slackSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        trim: true
    },
    team_id: {
        type: String,
        required: true,
        trim: true
    },
    domain: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Domain'
    },
    enterprise_id: {
        type: String,
        trim: true
    },
    installation_payload: {
        type: Object
    },
    bot_payload: {
        type: Object
    },
    settings: {
        approvals: {
            type: Number,
            required: true,
            default: 1
        }
    },
    tickets: [slackTicketSchema]
}, {
    timestamps: true
});

slackSchema.options.toJSON = {
    getters: true,
    virtuals: true,
    minimize: false,
    transform: function (doc, ret) {
        if (ret.updatedAt || ret.createdAt) {
            ret.updatedAt = moment(ret.updatedAt).format('YYYY-MM-DD HH:mm:ss');
            ret.createdAt = moment(ret.createdAt).format('YYYY-MM-DD HH:mm:ss');
        }
        return ret;
    }
};

slackSchema.methods.isTicketOpened = function (ticket_content) {
    const slack = this;
    return slack.tickets.filter(ticket => 
        ticket.environment === ticket_content.environment &&
        ticket.group === ticket_content.group &&
        ticket.switcher === ticket_content.switcher &&
        ticket.ticket_status === TicketStatusType.OPENED);
};

const Slack = mongoose.model('Slack', slackSchema);

export default Slack;