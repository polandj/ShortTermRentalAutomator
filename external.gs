/* ================================================
 * All external communication and state 
 * ================================================
 */

/*  Clean up old reservations
 *  https://developers.google.com/apps-script/guides/services/quotas
 *  Properties value size: 9kB per value
 *  Properties total storage: 500kB per property store
 *  https://developers.google.com/calendar/v3/reference/events
 *  Event IDs have lowercase letters a-v and digits 0-9
 *  e.g. "dnu5a0env4sl3i4a231qg703f0"
 */
function prune_reservations() {
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
        if (rec.checkout && Date.parse(rec.checkout) < now) {
          //cancel_lock(rec.phone)
          properties.deleteProperty(keys[i])
          console.info(`Removed old event property ${keys[i]}: ${rec.name}`)
        } else if (rec.checkout && ((Date.parse(rec.checkout) - now.valueOf())/1000/86400) < 4) {
          console.info(`XXX - TODO - Remind cleaners a few days before checkout (${rec.name})`)
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
  var retval = false
  if (!to) {
    console.warn(`send_email called with empty TO`)
    return retval
  }
  var properties = PropertiesService.getUserProperties()
  if (properties.getProperty('master_switch') == 'on' ||
      properties.getProperty('admin_email') == to) {
    var options = {}
    if (properties.getProperty('mail_from')) {
      options.from = properties.getProperty('mail_from')
    }
    if (htm) {
      options.htmlBody = htm
    }
    GmailApp.sendEmail(to, subject, txt, options)
    console.info(`Sent mail to ${to}: ${subject}`)
    retval = true
  } else {
    console.info('[TESTING] Skipped sending mail to ' + to + ': ' + subject)
    console.info('[TESTING]' + txt)
    console.info('[TESTING]' + htm)
  }
  return retval
}

function send_sms(to, msg) {
  var retval = false
  if (!to) {
    console.warn(`send_sms called with empty TO`)
    return retval
  }
  if (!msg || msg.length == 0) {
    console.warn(`send_sms called with empty MSG`)
    return retval
  }
  if (msg.length > 160) {
    console.error(`SMS text to ${to} too long (${msg.length})`)
    return retval
  }
  
  var properties = PropertiesService.getUserProperties()
  var account = properties.getProperty('twilio_acct')
  var authSID = properties.getProperty('twilio_sid')
  var authToken = properties.getProperty('twilio_tok')
  var from = properties.getProperty('twilio_phone')
  
  if (!account || !authSID || !authToken || !from) {
    console.error(`send_sms called but twilio is not fully configured`)
    return retval
  }

  var url = "https://api.twilio.com/2010-04-01/Accounts/" + account + "/Messages.json"

  var options = {
    method: "POST",
    headers: {
      Authorization: "Basic " + Utilities.base64Encode(authSID + ":" + authToken)
    },
    payload: {
      "From" : "+1" + from.replace(/\D/g, '').slice(-10),
      "To"   : "+1" + to.replace(/\D/g, '').slice(-10),
      "Body" : msg
    },
    muteHttpExceptions: true
  }

  if (properties.getProperty('master_switch') == 'on' ||
      properties.getProperty('admin_phone') == to) {
    var response = JSON.parse(UrlFetchApp.fetch(url, options).getContentText())
    if (response.hasOwnProperty("sid")) {
      console.info(`SMS sent to ${to}`) 
      retval = true
    }
  } else {
    console.info('[TESTING] Skipped sending SMS to ' + to)
  }
  return retval
}

function formatDate(dv) {
  var tz = CalendarApp.getDefaultCalendar().getTimeZone()
  var ddv = new Date(dv)
  return Utilities.formatDate(ddv, tz, 'MMM dd, yyyy')
}

function call_lock(uri, data) {
  var properties = PropertiesService.getUserProperties()
  var lm_url = properties.getProperty('lock_manager_url') + uri
  var lm_auth = properties.getProperty('lock_manager_auth')
  var retval = false
  
  var options = {
    method: "POST",
    contentType: 'application/json',
    headers: {
      Authorization: "Bearer " + lm_auth
    },
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  }
  if (properties.getProperty('master_switch') == 'on' ||
      properties.getProperty('admin_phone') == data.phone) {
    var response = UrlFetchApp.fetch(lm_url, options)
    console.log("lock manager response code: " + response.getResponseCode())
    if (response.getResponseCode() == 201) {
      console.info(`Lock scheduled for ${JSON.stringify(data)}`)
      retval = true 
    }
  } else {
    console.info(`[TESTING] Skipped calling lock api for ${JSON.stringify(data)}`)
  }
  return retval
}
  
function schedule_lock(name, phone, checkin, checkout, guests, cleaner_phone) {
  var data = {
    "name": name,
    "phone": phone,
    "checkin": formatDate(checkin),
    "checkout": formatDate(checkout),
    "guests": guests,
    "cleaner_phone": cleaner_phone
  }
  return call_lock('/reservation', data)
}

function edit_lock(name, phone, checkin, checkout, guests, cleaner_phone) {
  var data = {
    "name": name,
    "phone": phone,
    "checkin": formatDate(checkin),
    "checkout": formatDate(checkout),
    "guests": guests,
    "cleaner_phone": cleaner_phone
  }
  return call_lock('/edit', data)
}

function cancel_lock(phone) {
  var data = {
    "phone": phone
  }
  return call_lock('/cancel', data)
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

