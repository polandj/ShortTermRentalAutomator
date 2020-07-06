/* ===============================================
 * Handling Emails from VRBO
 * --------------------------
 * Process the emails that are sent from VRBO
 * when someone does an instant booking:
 *  + Parse them                                 
 *  + Post them to the web form above  
 * =============================================== 
 */
var VRBO_FROM_MATCH = "messages.homeaway.com"
var VRBO_SUBJ_MATCH = "Instant Booking from"
var VRBO_DONE_LABEL = "sent_to_webform"
var NEWER_THAN = "1d"
var TESTING_NEWER_THAN = "7d"

function getNewVRBOMessages()
{
  var threads
  var properties = PropertiesService.getUserProperties()
  if (properties.getProperty('master_switch') == 'on') {
    threads = GmailApp.search("newer_than:" + NEWER_THAN + " AND from:" + VRBO_FROM_MATCH + 
                              " AND subject:" + VRBO_SUBJ_MATCH + " AND -label:" + VRBO_DONE_LABEL)
  } else {
    threads = GmailApp.search("newer_than:" + TESTING_NEWER_THAN + " AND from:" + VRBO_FROM_MATCH + 
                              " AND subject:" + VRBO_SUBJ_MATCH + " AND -label:" + VRBO_DONE_LABEL)
  }
  var messages=[]
  threads.forEach(function(thread) {
    messages.push(thread.getMessages()[0])
  })
  return messages
}

function parseVRBOMessages(messages)
{
  var records=[];
  for(var m=0;m<messages.length;m++)
  {
    var text = messages[m].getPlainBody()
    
    var dates = text.match(/Dates:[\r\n]+[ ]+([\w]+) ([\d]+)[ ]?-[ ]?([\w]+) ([\d]+),[ ]?([\d]{4})/m)
    var guests = text.match(/Guests:[\r\n]+[ ]+(.+)/m)
    var name = text.match(/Traveler Name:[\r\n]+[ ]+(.+)/m)
    var phone = text.match(/Traveler Phone:[\r\n]+[ ]+(.+)/m)
    
    if(dates && guests && name && phone) {
      var rec = {};
      rec.checkin = dates[1] + " " + dates[2] + "," + dates[5]
      rec.checkout = dates[3] + " " + dates[4] + "," + dates[5]
      rec.guests = guests[1]
      rec.name = name[1]
      rec.phone = "+1" + phone[1].replace(/\D/g, '').slice(-10)
      // Basic validation
      var valid_start = new Date(rec.checkin).valueOf() ? true : false
      var valid_stop = new Date(rec.checkout).valueOf() ? true : false
      if (valid_start && valid_stop && rec.phone.length == 12) {
        var result = saveReservation(rec)
        if (result && result.status == "booked") {
          labelVRBOMessageDone(messages[m])
        }
        records.push(rec)
      }
    } else {
      console.error("Error parsing VRBO message!")
      console.info(text)
    }
  }
  return records
}

function processVRBOEmails()
{
  var messages = getNewVRBOMessages();
  var records = parseVRBOMessages(messages);
  console.info("Processed " + records.length + " emails")
  return true
}

function labelVRBOMessageDone(message)
{
  var properties = PropertiesService.getUserProperties()
  if (properties.getProperty('master_switch') == 'on') {
    var label_obj = GmailApp.getUserLabelByName(VRBO_DONE_LABEL)
    if(!label_obj) {
      label_obj = GmailApp.createLabel(VRBO_DONE_LABEL)
    }
    label_obj.addToThread(message.getThread() )
  } else {
    console.info("[TESTING] Skipped labeling of VRBO emails due to testing mode")
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

