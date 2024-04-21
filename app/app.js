"use strict";

let state = {
  selectedView: { name: "home" },
};

let db = new PouchDB('friends');

const routes = [
  {
    pattern: 'contacts/add',
    handler: renderAddContact,
  },
  { 
    pattern: 'contacts/{id}', 
    handler: renderContact, 
  },
  { 
    pattern: 'contacts/{id}/notes/add', 
    handler: renderContactAddNote,
  },
  { 
    pattern: 'contacts/{id}/notes/{id}', 
    handler: renderViewNote 
  }
]
const defaultRouteHandler = renderHome;

const webShareSupported = 'canShare' in navigator;


async function navigateToView() {
  let hash = window.location.hash.split("#");
  let app = document.getElementById("app");
  
  // Default route
  if (hash.length == 1) {
    console.debug("Default route");
    await defaultRouteHandler(app);
    return true;
  }

  for (let route of routes) {
    let regexPattern = route.pattern.replace(/\{(\w+)\}/g, '(\\w+)'); // Convert placeholders to regex pattern
    let regex = new RegExp('^' + regexPattern + '$'); // Create regex pattern for matching
    let match = hash[1].match(regex);
    if (match) {
      let params = match.slice(1); // Extract variable values
      console.log(`Params: ${params}`);
      await route.handler(app, ...params); // Call route handler with extracted params
      return true; // Route matched
    }
  }
}

async function renderContact(app, params) {
  const contact = await getContact(params);
  if (!contact) {
    console.log("Could not load contact");
    return false;
  }
  const notes = await getContactNotes(params);
  
  app.innerHTML = `
<header class="sticky three-column">
  <p class="nav"><a href="#" class="home-link">
    <svg
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 22 22"
      width="22px"
      height="22px"
    >
      <path
        fill="none"
        stroke="#1768AC"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M5 12h14M5 12l4 4m-4-4l4-4"
      />
    </svg>
  </a></p>
  <p class="title">${contact.short_name}</p>
  <p class="context">&nbsp;</p>
</header>
<div class="view">
  <section id="contact-notes">
    <p class="add-thing"><a href="#contacts/${params}/notes/add">
      <svg
        role="img"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width="24px"
        height="24px"
      >
        <path
          fill="none"
          stroke="#007AFF"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="32"
          d="M256 112v288m144-144H112"
        />
      </svg>
      Add new note
    </a></p>
    <notes-list></notes-list>
  </section>
</div>
`;

  const contactContainer = document.querySelector("contact-details");
  contactContainer.name = contact.short_name;
  const notesContainer = document.querySelector("notes-list");
  notesContainer.notes = notes;
}

async function renderViewNote(params) {
  console.log("HENLO");
  // TODO
}

async function renderContactAddNote(app, params) {
  app.innerHTML = `
<div class="view">
  <h2>Add note</h2>
  <form id="new-note-form">
    <p>Text: <input type="text" id="note-body"></p>
    <p><button type="submit">Add note</button></p>
  </form>
</div>
`;
  const form = document.getElementById("new-note-form");
  form.addEventListener("submit", (event) => {
    const contactId = params; //  just the "contact_xxx" id 
    const body = document.getElementById("note-body");
    addNote(contactId, body.value)
      .then(() => {})
      .catch(() => console.error("Failed to add note"));
    window.location.hash = `#contacts/${params}`;
  });
}

async function renderAddContact(app, params) {
  app.innerHTML = `
<div class="view">
  <h2>Add contact</h2>
  <form id="new-contact-form">
    <p>Name: <input type="text" id="contact-name"></p>
    <p><button type="submit">Add contact</button></p>
  </form>
</div>
`;
  const form = document.getElementById("new-contact-form");
  form.addEventListener("submit", (event) => {
    // Prevent the form from submitting to the server
    // since everything is client-side.
    event.preventDefault();
    const name = document.getElementById("contact-name");
    addFriend(name.value)
      .then(() => {})
      .catch(() => console.error("Failed ot add contact"));
    window.location.hash = "#"; // go to home page
  });
}

async function renderHome(app) {
  console.log("ReNDERING HOME");
  app.innerHTML = `
<header class="top-level">
  <h1>Friends</h1>
</header>
<div class="view">
  <p class="add-thing"><a href="#contacts/add">
    <svg
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="24px"
      height="24px"
    >
      <path
        fill="none"
        stroke="#007AFF"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="32"
        d="M256 112v288m144-144H112"
      />
    </svg>
    Add friend
  </a></p>
  <section id="friends-list">
    <friends-list></friends-list>
  </section>
  <p class="add-thing"><a href="#" onClick="doExport();">
    <svg
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 22 22"
      width="22px"
      height="22px"
    >
      <path
        fill="#007AFF"
        fill-rule="evenodd"
        d="M13 5.828V17h-2V5.828L7.757 9.071L6.343 7.657L12 2l5.657 5.657l-1.414 1.414zM4 16h2v4h12v-4h2v4c0 1.1-.9 2-2 2H6c-1.1 0-2-.963-2-2z"
      />
    </svg>
    <span id="export-link">Export data</span>
  </a></p>
</div>
  `;
  const list = document.querySelector("friends-list");
  list.friends = await getFriends();

  const expLink = document.getElementById("export-link");
  expLink.textContent = webShareSupported ? 'Share data' : 'Download data';
}

async function shareOrDownload() {
  let friends = await getFriends();
  let blob = new Blob([JSON.stringify(friends)], {
    type: 'text/plain'
  });

  if (webShareSupported) {
    let files = [
      new File([blob], 'friends.txt', {
        type: blob.type,
      })
    ];
    let data = {
      title: "mainmates Export",
      files
    }

    if (navigator.canShare(data)) {
      try {
        await navigator.share(data);
      }
      catch(e) {
        alert(`share error - ${e}`);
      } finally {
        return;
      }
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = "export.json";
  a.style.display = "none";
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
    a.remove();
  }, 1000);
}

window.addEventListener("hashchange", navigateToView);
navigateToView()
  .then(() => console.log("route matched"))
  .catch((err) => console.log(`no route matched - ${err}`));



db.changes({
  since: 'now',
  live: true
}).on('change', navigateToView);


function showError(message) {
  const errorElement = document.createElement("p");
  errorElement.textContent = message;
  errorElement.style.color = "red";
  const errorBanner = document.querySelector("#error-banner");
  errorBanner.appendChild(errorElement);
  errorBanner.style.display = "block";
}

function formatDate(dateString) {
  // Convert the date string to a Date object.
  const date = new Date(dateString);

  // Format the date into a locale-specific string.
  // include your locale for better user experience
  return date.toLocaleDateString(undefined, { timeZone: "UTC" });
}



// STATE ----------------------------------------------

async function getContact(id) {
  try {
    console.log(`Searching for contact ${id}`);
    var result = await db.get(id);
    // console.log(result);
    return result;
  } catch (err) {
    console.error(err);
  }
}

async function getContactNotes(contactId) {
  try {
    var notes = await db.allDocs({
      include_docs: true,
      startkey: `note_${contactId}`,
      endkey: `note_${contactId}\ufff0`
    })
    return notes.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function getFriends() {
  try {
    var result = await db.allDocs({
      include_docs: true, 
      startkey: 'contact', // e.g. 'contact_1713622675061',
      endkey: 'contact\ufff0' // e.g. 'contact_1713622675061'
    });
    return result.rows;
  } catch (err) {
    console.log(err);
  }
}

// To test in the web developer console:
// friend = await addFriend("Sam");
// friend.id;
async function addFriend(name) {
  const id = new Date().getTime();
  try {
    let result = await db.put({
      _id: `contact_${id}`,
      short_name: name,
    });
    return result;
  } catch (err) {
    console.log(err);
  }
}

async function addNote(contactId, body) {
  const id = new Date().getTime();
  const time = new Date().getTime();
  try {
    let result = await db.put({
      _id: `note_${contactId}_${id}`,
      body,
      time
    });
    return result;
  } catch (err) {
    console.log(err);
  }
}


// COMPONENTS ----------------------------------------------

class FriendsList extends HTMLElement {
  set friends(value) {
    this._friends = value;
    this.updateComponent();
  }

  get friends() {
    return this._friends;
  }

  connectedCallback() {
    this.updateComponent();
  }

  updateComponent() {
    if (!this.friends) {
      return;
    }
    this.innerHTML = `<ul class="friend-list">${this.friends
      .map(
        (friend) => `
        <li>
          <a href="#contacts/${friend.id}">${friend.doc.short_name}</a>
        </li>`
      )
      .join("")}</div>`;
  }
}
customElements.define("friends-list", FriendsList);


class ContactDetails extends HTMLElement {
  set name(value) {
    this._name = value;
    this.updateComponent();
  }

  get name() {
    return this._name;
  }

  connectedCallback() {
    this.updateComponent();
  }

  updateComponent() {
    this.innerHTML = `<div class="contact-details">
      <header><h2>${this.name}</h2>
      </div>`;
  }
}
customElements.define("contact-details", ContactDetails);


class NotesList extends HTMLElement {
  set notes(value) {
    this._notes = value;
    this.updateComponent();
  }

  get notes() {
    return this._notes;
  }

  connectedCallback() {
    this.updateComponent();
  }

  updateComponent() {
    if (!this.notes) {
      return;
    }
    console.log(this.notes);
    this.innerHTML = `<div class="note-list">${this.notes
      .map(
        (note) => `
        <div class="note-note">
          <div class="note-icon">
            <svg
              role="img"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 256 256"
              width="20px"
              height="20px"
            >
              <path
                fill="#1768AC"
                d="m235.32 81.37l-60.69-60.68a16 16 0 0 0-22.63 0l-53.63 53.8c-10.66-3.34-35-7.37-60.4 13.14a16 16 0 0 0-1.29 23.78L85 159.71l-42.66 42.63a8 8 0 0 0 11.32 11.32L96.29 171l48.29 48.29A16 16 0 0 0 155.9 224h1.13a15.93 15.93 0 0 0 11.64-6.33c19.64-26.1 17.75-47.32 13.19-60L235.33 104a16 16 0 0 0-.01-22.63M224 92.69l-57.27 57.46a8 8 0 0 0-1.49 9.22c9.46 18.93-1.8 38.59-9.34 48.62L48 100.08c12.08-9.74 23.64-12.31 32.48-12.31A40.13 40.13 0 0 1 96.81 91a8 8 0 0 0 9.25-1.51L163.32 32L224 92.68Z"
              />
            </svg>
          </div>
          <div class="note-content">
            <div class="note-meta">
              <p>Note</p>
              <p>${formatDate(note.doc.time)}</p>
            </div>
            <p>${note.doc.body}</p>
          </div>
        </div>`
      )
      .join("")}</div>`;
  }
}
customElements.define("notes-list", NotesList);


class NewNoteForm extends HTMLElement {
  set contactId(value) {
    this._contactId = value;
    this.updateComponent();
  }

  get contactId() {
    return this._contactId;
  }

  connectedCallback() {
    this.updateComponent();
  }

  updateComponent() {
    if (!this.contactId) {
      return;
    }
    this.innerHTML = `          <form>
      <nav class="sheet-actions">
        <a href="#" onclick="hidePopover(); return false;">Cancel</a>
        <button type="submit">Save</button>
      </nav>
      <p>
        <label for="date">Date</label>
        <input type="date" id="note-date" required />
      </p>
      <p>
        <label for="type">Type</label>
        <select id="note-type" required>
          <option value="">Select a type</option>
          <option value="phone">Phone call</option>
          <option value="meeting">Hang out</option>
          <option value="update">Update</option>
        </select>
      </p>
      <p>
        <label for="note">Note</label>
      </p>
      </p>
        <textarea id="note-text" required></textarea>
      </p>
      <input type="hidden" name="contactId"
    </form>`;
  }
}
customElements.define("new-note-form", NewNoteForm);
