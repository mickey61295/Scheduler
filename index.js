const express = require('express');
const moment = require('moment');
const momentTz = require('moment-timezone');
const _ = require('lodash');
const ics = require('ics');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = process.env.PORT;
function generateTimeSlots(startTime, endTime, chunkDuration, breakDuration = 0) {
    const ist = 'Asia/Kolkata';
    const today = momentTz.tz(moment(), ist).startOf('day');
    const start = momentTz.tz(moment(startTime, 'hh:mm A'), ist);
    const end = momentTz.tz(moment(endTime, 'hh:mm A'), ist);
    let slots = [];
    while (start.add(chunkDuration, 'minutes').isSameOrBefore(end)) {
        slots.push({start: start.clone(), end: start.clone().add(chunkDuration, 'minutes')});
        start.add(breakDuration, 'minutes');
    }
    return slots;
}

function scheduleTasks(workSlots, hobbySlots) {
    let allSlots = workSlots.concat(hobbySlots);
    allSlots.sort((a, b) => a.start - b.start);
    let schedule = [];
    for (let slot of allSlots) {
        if (!schedule.length || schedule[schedule.length - 1].end.clone().add(10, 'minutes').isSameOrBefore(slot.start)) {
            schedule.push(slot);
        }
    }
    return schedule;
}

app.get('/schedule', (req, res) => {
    // Generate 15 random work slots
    let workSlots = generateTimeSlots('10:00 AM', '7:00 PM', 20, 10);
    workSlots = _.sampleSize(workSlots, 15);

    // Generate 10 random hobby slots
    let hobbySlots = generateTimeSlots('8:00 AM', '8:00 PM', 15, 10);
    hobbySlots = _.sampleSize(hobbySlots, 60);

    // Schedule tasks
    let schedule = scheduleTasks(workSlots, hobbySlots);

    // Create an array of events for the ics file
    let workSlotCounter = 1;
    let hobbySlotCounter = 1;
    let events = schedule.map(slot => {
        let title;
        if (workSlots.includes(slot)) {
            title = `Work Slot ${workSlotCounter++}`;
        } else {
            title = `Hobby Slot ${hobbySlotCounter++}`;
        }
        return {
            start: slot.start.tz('Asia/Kolkata').format('YYYYMMDDTHHmmss'),
            end: slot.end.tz('Asia/Kolkata').format('YYYYMMDDTHHmmss'),
            title: title,
            description: 'This is a scheduled slot.',
            alarms: [{
                action: 'display',
                trigger: { minutes: 2, before: true },
                description: 'Reminder'
            }]
        };
    });

    // Generate the ics data
    ics.createEvents(events, (error, value) => {
        if (error) {
            console.log(error);
            res.status(500).send('Error generating ics file.');
            return;
        }

        // Create a transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            service: 'gmail',  // use 'gmail' for Gmail
            auth: {
                user: process.env.senderMail,  // your email
                pass: process.env.senderPass  // your email password
            }
        });

        // Email options
        let mailOptions = {
            from: process.env.senderMail,  // sender address
            to: process.env.receiverMail,  // list of receivers
            subject: `${momentTz.tz('Asia/Kolkata').format('YYYY-MM-DD')} Schedule`,  // Subject line
            text: 'Here is your schedule.',  // plain text body
            attachments: [
                {
                    filename: momentTz.tz('Asia/Kolkata').format('YYYY-MM-DD') + '.ics',
                    content: value
                }
            ]
        };

        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                res.status(500).send('Error sending email.');
                return;
            }
            console.log('Email sent: ' + info.response);
            res.send('Email sent');
        });
    });
});

app.listen(port, () => console.log(`Server running on port ${port}`));