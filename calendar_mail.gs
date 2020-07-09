/* ================================================
 * Handling Calendar notification emails   
 * -------------------------------------
 * Process the calendar notification emails that
 * are sent before a guest checks in:
 *  + Parse them                               
 *  + Send notifies                            
 *  + Schedule lock code                       
 * ================================================
 */
var CAL_FROM_MATCH = "calendar-notification@google.com"
var CAL_SUBJ_MATCH = "Notification"
var CAL_DONE_LABEL = "sent_to_guest_and_lock"

function getNewCalendarMessages()
{
  var threads
  var properties = PropertiesService.getUserProperties()
  if (properties.getProperty('master_switch') == 'on') {
    threads = GmailApp.search("newer_than:" + NEWER_THAN + " AND from:" + CAL_FROM_MATCH + 
                              " AND subject:" + CAL_SUBJ_MATCH + " AND -label:" + CAL_DONE_LABEL)
  } else {
    threads = GmailApp.search("newer_than:" + TESTING_NEWER_THAN +" AND from:" + CAL_FROM_MATCH + 
                              " AND subject:" + CAL_SUBJ_MATCH + " AND -label:" + CAL_DONE_LABEL)
  }
  var messages=[]
  threads.forEach(function(thread) {
    messages.push(thread.getMessages()[0])
  })
  return messages
}

function parseCalendarMessages(messages)
{
  var records=[];
  for(var m=0;m<messages.length;m++)
  {
    var body = messages[m].getBody()
    var rec = {}
    try {
      rec.id = body.match(/meta itemprop="eventId\/googleCalendar" content="([^\"]+)"/)[1]
      rec.name = body.match(/itemprop="name">([^<]+)<\/span>/)[1]
      var description = body.match(/itemprop="description" content="(Guests: [^\"]+)"/m)[1]
      rec.guests = description.match(/Guests:\s*(.+)/)[1]
      rec.phone = description.match(/Phone:\s*(.+)/)[1]
      var start_time = body.match(/itemprop="startDate" datetime="(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z"/)
      var end_time = body.match(/itemprop="endDate" datetime="(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z"/)
      rec.checkin = new Date(Date.UTC(start_time[1], start_time[2]-1, start_time[3], 
                                       start_time[4], start_time[5], start_time[6]))
      rec.checkout = new Date(Date.UTC(end_time[1], end_time[2]-1, end_time[3], 
                                     end_time[4], end_time[5], end_time[6]))
    } catch(err) {
      console.error("Error parsing calendar message: " + err)
      console.info(body)
    }
    if (rec.name && rec.phone && rec.guests && rec.checkin && rec.checkout) {
      console.info("Parsed notification -> " + JSON.stringify(rec))
      
      var properties = PropertiesService.getUserProperties()
      var oldjson = properties.getProperty(rec.id)
      var oldrec = oldjson ? JSON.parse(oldjson) : null
      
      if (!oldrec || !oldrec.guest_welcomed) {
        var guest_text = properties.getProperty('guest_text')
        if (guest_text) {  
          rec.guest_welcomed = send_sms(rec.phone, guest_text)
        } else {
          console.warn(`No guest_text property set, not texting ${name} initial introduction`)
        }
      }
      
      if (!oldrec || !oldrec.cleaners_reminded) {
        var site_name = properties.getProperty('site_name')
        var cleaner_phone = properties.getProperty('cleaner_phone')
        var cln_txt = `Cleaning reminder for ${site_name} on ${formatDate(rec.checkout)}. `
        cln_txt += `There are ${rec.guests} staying ${formatDate(rec.checkin)} to ${formatDate(rec.checkout)}.`
        rec.cleaners_reminded = send_sms(cleaner_phone, cln_txt)
      }
      
      if (!oldrec || !oldrec.lock_scheduled) {
        rec.lock_scheduled = schedule_lock(rec.name, rec.phone, rec.checkin, rec.checkout, rec.guests)
      }
      
      // Use Object.assign to merge rec and oldrec into a new record 
      properties.setProperty(rec.id, JSON.stringify(Object.assign({}, oldrec, rec)))
      
      if (rec.guest_welcomed && rec.lock_scheduled) {
        labelCalendarMessageDone(messages[m])
      }
      records.push(rec)
    }
  }
  return records
}

function processCalendarEmails()
{
  var messages = getNewCalendarMessages()
  var records = parseCalendarMessages(messages)
  console.info("Processed " + records.length + " emails")
  return true
}

function labelCalendarMessageDone(message)
{
  var properties = PropertiesService.getUserProperties()
  if (properties.getProperty('master_switch') == 'on') {
    var label_obj = GmailApp.getUserLabelByName(CAL_DONE_LABEL)
    if(!label_obj) {
      label_obj = GmailApp.createLabel(CAL_DONE_LABEL)
    }
    label_obj.addToThread(message.getThread() )
  } else {
    console.info("[TESTING] Skipped labeling of Calendar emails due to testing mode")
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
