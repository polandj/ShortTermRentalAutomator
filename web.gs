/* =========================================================
 * Interactive Website 
 * --------------------
 * Presents an interactive page for adding reservations and
 * associated configuration for everything else.
 * ==========================================================
 */
/* Allows including templates in other templates */
function include(filename) {
  var templ = HtmlService.createTemplateFromFile(filename)
  templ.home_url = ScriptApp.getService().getUrl()
  return templ.evaluate().getContent()
}

/* Template for a typical styled HTML input field */
function input_field(propname, proplabel, proptype, {
                     maxlength = '', pattern = '', hint = '', required=false} = {}) {
  var templ = HtmlService.createTemplateFromFile('input_field')
  templ.properties = PropertiesService.getUserProperties()
  templ.propname = propname
  templ.proplabel = proplabel
  templ.proptype = proptype
  templ.maxlength = maxlength
  templ.pattern = pattern
  templ.hint = hint
  templ.required = required
  return templ.evaluate().getContent()
}

/* The only accessible HTTP endpoint */
function doGet(e) {
  var templ
  if(e.queryString !== '') {  
    templ = HtmlService.createTemplateFromFile(e.parameter.page)
  } else {
    templ = HtmlService.createTemplateFromFile('index')
  }
  templ.home_url = ScriptApp.getService().getUrl()
  templ.properties = PropertiesService.getUserProperties()
  templ.gmail_addr = Session.getActiveUser().getEmail()
  return templ.evaluate()
}

/* Called from index.html and vrbo_mail.gs to save a reservation */
function saveReservation(formObject) {
  var name = formObject.name.trim()
  var phone = formObject.phone.trim()
  var guests = formObject.guests.trim()
  var checkin = formObject.checkin.trim()
  var checkout = formObject.checkout.trim()
  // Basic Validation
  if (!name || name.length < 3) {
    return {status: "error", reason: "Name too short"}
  }
  if (!phone || phone.length < 10) {
    return {status: "error", reason: "Invalid phone"}
  }
  phone = "+1" + phone.replace(/\D/g, '').slice(-10)
  var start_date = new Date(checkin + "T00:00:00")
  var stop_date = new Date(checkout + "T00:00:00")
  var now = new Date()
  if (now > start_date || now > stop_date || start_date >= stop_date) {
    return {status: "error", reason: "Invalid dates"}
  }
  var properties = PropertiesService.getUserProperties()
  checkin_time = properties.getProperty('checkin_time')
  if (checkin_time) {
    var checkin_parts = checkin_time.split(':')
    start_date.setHours(parseInt(checkin_parts[0]))
    start_date.setMinutes(parseInt(checkin_parts[1]))
  } else {
    start_date.setHours(16) // Default: 4pm
  }
  checkout_time = properties.getProperty('checkout_time')
  if (checkout_time) {
    var checkout_parts = checkout_time.split(':')
    stop_date.setHours(parseInt(checkout_parts[0]))
    stop_date.setMinutes(parseInt(checkout_parts[1]))
  } else {
    stop_date.setHours(11) // Default: 11am
  }
  
  // Check for conflicting reservations
  var events = CalendarApp.getDefaultCalendar().getEvents(start_date, stop_date)
  if (events && events.length > 0) {
    return {status: "error", reason: "Conflict with other reservation"}
  }
  
  // Create calendar entry
  var descr = `Guests: ${guests}\r\nPhone: ${phone}`
  var properties = PropertiesService.getUserProperties()
  var event
  if (properties.getProperty('master_switch') == 'on' || 
      properties.getProperty('admin_phone') == phone) {
    event = CalendarApp.getDefaultCalendar().createEvent(name, 
                  start_date, stop_date, 
                  {description: descr})
    var mins_til_start = (start_date.getTime() - now.getTime())/1000/60
    event.addEmailReminder(Math.min(mins_til_start - 10, 10080)) // 1 week or a few minutes from now
    console.info("Created " + name + " calendar event: " + checkin + " - " + checkout)
  } else {
    console.info("[TESTING] Skipped creating " + name + " calendar event: " + checkin + " - " + checkout)
  }
  return {status: "booked", event: event ? event.getId() : "", name: name, 
          phone: phone, guests: guests, checkin: checkin, checkout: checkout}
}

/* Called from all the configuration pages */
function saveSettings(formObject) {
  var retval = {status: "saved"}
  var properties = PropertiesService.getUserProperties()
  for (const [key, value] of Object.entries(formObject)) {
    properties.setProperty(key, value)
    retval[key] = value
  }
  console.info(retval)
  return retval
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

