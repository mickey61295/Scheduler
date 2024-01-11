const express = require('express');
const moment = require('moment');
const momentTz = require('moment-timezone');
const _ = require('lodash');
const ics = require('ics');
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
    let events = schedule.map(slot => ({
        start: slot.start.format('YYYYMDTHHmmssZ'),
        end: slot.end.format('YYYYMDTHHmmssZ'),
        title: 'Scheduled Slot',
        description: 'This is a scheduled slot.',
        startOutputType: 'local',
        endOutputType: 'local',
        alarms: [{
            action: 'display',
            trigger: { minutes: 2, before: true },
            description: 'Reminder'
        }]
    }));

    // Generate the ics data
    ics.createEvents(events, (error, value) => {
        if (error) {
            console.log(error);
            res.status(500).send('Error generating ics file.');
            return;
        }

        // Set the correct headers and send the ics data as a response
        res.set({
            'Content-Type': 'text/calendar',
            'Content-Disposition': 'inline; filename=schedule.ics'
        });
        res.send(value);
    });
});

app.listen(port, () => console.log(`Server running on port ${port}`));