/* ======================================
 * Handle calendar changes
 * -------------------------
 * Deal with changes to the calendar
 * ======================================
 */
function parseEvent(event) {
  var guests = event.description ? event.description.match(/Guests: (.+)/) : ""
  var phone = event.description ? event.description.match(/Phone: (.+)/) : ""
  if (phone && guests) {
    var rec = {}
    rec.id = event.id
    rec.name = event.summary
    rec.checkin = event.start.dateTime
    rec.checkout = event.end.dateTime
    rec.phone = "+1" + phone[1].replace(/\D/g, '').slice(-10)
    rec.guests = guests[1]
    
    // Only care about future events
    var now = new Date()
    var stopdate = new Date(event.end.dateTime)
    if (rec.phone.length == 12 && now < stopdate) {
      return rec
    } else {
      if (rec.phone.length != 12) {console.error("Ignoring %s - bad phone", event.summary)}
      if (now > stopdate) {console.error("Ignoring %s - past event", event.summary)}
    }
  }
}

function compareRecords(oldrec, newrec) {
  var ret = {}
  if (oldrec.checkin != newrec.checkin) {
    ret.checkin = true 
  }
  if (oldrec.checkout != newrec.checkout) {
    ret.checkout = true
  }
  if (oldrec.phone != newrec.phone) {
    ret.phone = true
  }
  if (oldrec.name != newrec.name) {
    ret.name = true
  }
  return ret
}

function processEvents(events, properties) {
  for (var i = 0; i < events.items.length; i++) {
    var event = events.items[i]
    var rec = parseEvent(event)
    var oldjson = properties.getProperty(event.id)
    var oldrec = oldjson ? JSON.parse(oldjson) : null
    if (rec) {
      if (oldrec) {
        var diff = compareRecords(oldrec, rec)
        if (Object.keys(diff).length !== 0) {
          console.log("Updated event[%s]: %s", event.id, event.summary)
          console.log(diff)
          if (diff.checkout) {
            notify_cleaners("cal-upd-email", "Move cleaning", rec, oldrec)
          }
        }
        // TODO 
        // - mail cleaners if dates changed
        // - Call groovy if on lock ?
      } else {
        console.log("New event[%s]: %s", event.id, event.summary)
        notify_cleaners("cal-new-email", "New cleaning", rec)
        // TODO - mail cleaners / call groovy if on lock?
      }
      properties.setProperty(event.id, JSON.stringify(rec))
    } else if (oldrec) {
      if (event.status === 'cancelled') {
        console.log('Event id %s was cancelled.', event.id);
        // TODO - mail cleaners / call groovy if on lock?
        notify_cleaners("cal-del-email", "Cancel cleaning", oldrec)
      }
    }
    else {
      console.error('Non-parsable reservation? ' + event.summary)
    }
  }
}

function notify_cleaners(template, subject, rec, oldrec) {
  var properties = PropertiesService.getUserProperties()
  var tmpl = HtmlService.createTemplateFromFile(template)
  tmpl.record = rec
  tmpl.oldrecord = oldrec
  tmpl.properties = properties
  tmpl.gmail_addr = Session.getActiveUser().getEmail()
  var body = tmpl.evaluate()
  var content = body.getAs("text/plain").getDataAsString()
  
  var htmlcontent = "<!DOCTYPE html><html><body>" + content.replace(/\n/g, '<br>') + "</body></html>"
  
  var to = properties.getProperty('cleaner_email')
  send_email(to, subject, content, htmlcontent)
}

function calendarUpdated(e) {
  var properties = PropertiesService.getUserProperties()
  var options = {
    maxResults: 5
  }
  var syncToken = properties.getProperty('syncToken')
  if (syncToken) {
    options.syncToken = syncToken;
  } else {
    // Sync events up to 10 seconds in past
    var recently = new Date(Date.now()-10000)
    options.updatedMin = recently.toISOString()
  }

  // Retrieve events one page at a time.
  var events
  var pageToken
  do {
    try {
      options.pageToken = pageToken
      events = Calendar.Events.list(e.calendarId, options)
    } catch (e) {
      // Check to see if the sync token was invalidated by the server;
      // if so, perform a full sync instead.
      if (e.message === 'Sync token is no longer valid, a full sync is required.') {
        properties.deleteProperty('syncToken')
        logSyncedEvents(e.calendarId, true)
        return
      } else {
        throw new Error(e.message)
      }
    }

    if (events.items && events.items.length > 0) {
      processEvents(events, properties)
    } else {
      console.log('No events found.')
    }

    pageToken = events.nextPageToken
  } while (pageToken)

  properties.setProperty('syncToken', events.nextSyncToken)
}

/*
Copyright(c) 2020 - Jonathan Poland (polandj@garble.org)
All Rights reserved

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
   * Neither the name of Google LLC nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
