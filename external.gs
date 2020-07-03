/* ================================================
 * All external communication and state 
 * ================================================
 */

/*  Clean up old properties
 *  https://developers.google.com/apps-script/guides/services/quotas
 *  Properties value size: 9kB per value
 *  Properties total storage: 500kB per property store
 *  https://developers.google.com/calendar/v3/reference/events
 *  Event IDs have lowercase letters a-v and digits 0-9
 *  e.g. "dnu5a0env4sl3i4a231qg703f0"
 */
function prune_properties() {
  var properties = PropertiesService.getUserProperties()
  var keys = properties.getKeys()
  console.info(`${keys.length} Properties`)
  console.info(keys)
  var now = new Date()
  for (var i = 0; i < keys.length; i++) {
    var eid = keys[i].match(/^[a-v0-9]+$/)
    if (eid) {
      var keyval = properties.getProperty(keys[i])
      try {
        var rec = JSON.parse(keyval)
        if (rec.checkout && rec.checkout < now) {
          properties.deleteProperty(keys[i])
          console.info(`Removed old event property ${keys[i]}: ${rec.name}`)
        } else if (!rec.checkout) {
          console.warn(`Event with no checkout? ${keys[i]}: ${JSON.stringify(rec)}`)
          properties.deleteProperty(keys[i])
          console.info(`Removed weird event property ${keys[i]}: ${rec.name}`)
        } else {
          console.info(rec)
        }
      } catch (err) {
        console.log(`Error pruning ${keys[i]} ${keyval}: ${err}`)
      }
    }
  }
}

function send_email(to, subject, txt, htm) {
  var properties = PropertiesService.getUserProperties()
  if (properties.getProperty('deploy_mode') == 'production' ||
      properties.getProperty('admin_email') == to) {
    var options = {}
    if (properties.getProperty('mail_from')) {
      options.from = properties.getProperty('mail_from')
    }
    if (html) {
      options.htmlBody = htm
    }
    GmailApp.sendEmail(to, subject, txt, options)
  } else {
    console.info('[TESTING] Skipped sending mail to ' + to + ': ' + subject)
    console.info('[TESTING]' + txt)
    console.info('[TESTING]' + htm)
  }
}

function send_sms(to, msg) {
  if (msg.length > 160) {
    console.error(`SMS text to ${to} too long (${msg.length})`)
    return
  }
  
  var properties = PropertiesService.getUserProperties()
  var account = properties.getProperty('twilio_acct')
  var authSID = properties.getProperty('twilio_sid')
  var authToken = properties.getProperty('twilio_tok')
  var from = properties.getProperty('twilio_phone')

  var url = "https://api.twilio.com/2010-04-01/Accounts/" + account + "/Messages.json"

  var options = {
    method: "POST",
    headers: {
      Authorization: "Basic " + Utilities.base64Encode(authSID + ":" + authToken)
    },
    payload: {
      "From" : from,
      "To"   : to,
      "Body" : msg
    },
    muteHttpExceptions: true
  }

  if (properties.getProperty('deploy_mode') == 'production' ||
      properties.getProperty('admin_phone') == to) {
    var response = JSON.parse(UrlFetchApp.fetch(url, options).getContentText())
    if (response.hasOwnProperty("sid")) {
      console.info(`SMS sent to ${to}`) 
    }
  } else {
    console.info('[TESTING] Skipped sending SMS to ' + to)
  }
}

function formatDate(dv) {
  var tz = CalendarApp.getDefaultCalendar().getTimeZone()
  var ddv = new Date(dv)
  return Utilities.formatDate(ddv, tz, 'MMM dd, yyyy')
}

function schedule_lock(name, phone, checkin, checkout, guests) {
  var properties = PropertiesService.getUserProperties()
  var lm_url = properties.getProperty('lock_manager_url')
  var lm_auth = properties.getProperty('lock_manager_auth')
  
  var data = {
    "name": name,
    "phone": phone,
    "checkin": formatDate(checkin),
    "checkout": formatDate(checkout),
    "guests": guests
  }
  var options = {
    method: "POST",
    contentType: 'application/json',
    headers: {
      Authorization: "Bearer " + lm_auth
    },
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  }
  if (properties.getProperty('deploy_mode') == 'production') {
    var response = UrlFetchApp.fetch(url, options)
    console.log("lock manager response code: " + response.getResponseCode())    
  } else {
    console.log(`[TESTING] Skipped adding lock code for  ${name}(${phone}) staying ${checkin} to ${checkout} with ${guests}`)
  }
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
