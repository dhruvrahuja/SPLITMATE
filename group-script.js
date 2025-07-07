// group-script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

//  Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD5v1hQyRFBPJ0-w-YczdmX5o6o_Gvyb1g",
  authDomain: "splitmate-6bde9.firebaseapp.com",
  projectId: "splitmate-6bde9",
  storageBucket: "splitmate-6bde9.firebasestorage.app",
  messagingSenderId: "1019210860491",
  appId: "1:1019210860491:web:ba4604756ca5a99c9c184e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get group ID from URL
const urlParams = new URLSearchParams(window.location.search);
const groupId = urlParams.get('id');
document.getElementById("group-id").textContent = groupId;
document.getElementById("share-link").textContent = window.location.href;

const groupRef = doc(db, "groups", groupId);

// If group doesn't exist, create it
const snap = await getDoc(groupRef);
if (!snap.exists()) {
  await setDoc(groupRef, {
    expenses: [],
    members: [],
    createdAt: new Date()
  });
}

// Realtime listener
onSnapshot(groupRef, (docSnap) => {
  const data = docSnap.data();

  // Members List
  const memberList = document.getElementById("member-list");
  memberList.innerHTML = "";
data.members.forEach(name => {
  const li = document.createElement("li");

  const span = document.createElement("span");
  span.textContent = name;

  const removeBtn = document.createElement("span");
  removeBtn.textContent = "❌";
  removeBtn.classList.add("remove-member");
  removeBtn.onclick = async () => {
    if (confirm(`Remove ${name} from the group?`)) {
      const newMembers = data.members.filter(m => m !== name);
      await updateDoc(groupRef, { members: newMembers });
    }
  };

  li.appendChild(span);
  li.appendChild(removeBtn);
  memberList.appendChild(li);
});


  // Paid By dropdown
  const paidByDropdown = document.getElementById("paidBy");
  paidByDropdown.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = "Select who paid";
  paidByDropdown.appendChild(placeholder);
  data.members.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    paidByDropdown.appendChild(option);
  });

  // Split Between checklist
const splitBetween = document.getElementById("split-between");
splitBetween.innerHTML = "";
data.members.forEach(name => {
  const wrapper = document.createElement("label");
  wrapper.className = "split-item";
  wrapper.htmlFor = "check_" + name;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = name;
  checkbox.id = "check_" + name;
  checkbox.name = "split-member";

  const span = document.createElement("span");
  span.textContent = name;

  wrapper.appendChild(checkbox);
  wrapper.appendChild(span);
  splitBetween.appendChild(wrapper);
});


  // Expense List
  const list = document.getElementById("expense-list");
  list.innerHTML = "";
  data.expenses.forEach(exp => {
    const li = document.createElement("li");
    if (exp.split && exp.split.length > 0) {
      const lines = exp.split.map(s => `${s.from} owes ${s.to} ₹${s.amount}`).join(", ");
      li.textContent = `${exp.description}: ${lines}`;
    } else {
      li.textContent = `${exp.paidBy} paid ₹${exp.amount} for "${exp.description}"`;
    }
    list.appendChild(li);
  });

  // Final Net Settlements
  const netMap = new Map();
  data.members.forEach(name => netMap.set(name, 0));

  data.expenses.forEach(exp => {
    if (exp.split) {
      exp.split.forEach(s => {
        netMap.set(s.from, netMap.get(s.from) - s.amount);
        netMap.set(s.to, netMap.get(s.to) + s.amount);
      });
    }
  });

  let debtors = [], creditors = [];
  for (let [name, balance] of netMap) {
    if (balance < -0.01) debtors.push({ name, amount: -balance });
    else if (balance > 0.01) creditors.push({ name, amount: balance });
  }

  const settlementList = document.getElementById("settlement-summary");
  settlementList.innerHTML = "";

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    let debtor = debtors[i];
    let creditor = creditors[j];
    let settledAmount = Math.min(debtor.amount, creditor.amount);

    const li = document.createElement("li");
    li.textContent = `${debtor.name} owes ${creditor.name} ₹${settledAmount.toFixed(2)}`;
    settlementList.appendChild(li);

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }
});

// Add Member
window.addMember = async function() {
  const input = document.getElementById("memberName");
  const name = input.value.trim();
  if (!name) return alert("Enter a name");

  const snap = await getDoc(groupRef);
  const data = snap.data();

  if (data.members.includes(name)) {
    alert("Member already exists");
    return;
  }

  const newMembers = [...data.members, name];
  await updateDoc(groupRef, { members: newMembers });
  input.value = "";
};

// Add Expense
window.addExpense = async function() {
  const paidBy = document.getElementById("paidBy").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);
  const description = document.getElementById("description").value.trim();

  if (!paidBy || !amount || !description) {
    alert("Please fill all fields");
    return;
  }

  const selected = [];
  const checkboxes = document.querySelectorAll('#split-between input[type=checkbox]');
  checkboxes.forEach(cb => {
    if (cb.checked) selected.push(cb.value);
  });

  if (selected.length === 0) {
    alert("Select at least one person to split with");
    return;
  }

  const perHead = parseFloat((amount / selected.length).toFixed(2));

  const splits = selected
    .filter(name => name !== paidBy)
    .map(name => ({
      from: name,
      to: paidBy,
      amount: perHead
    }));

  await updateDoc(groupRef, {
    expenses: arrayUnion({
      paidBy,
      amount,
      description,
      timestamp: new Date().toISOString(),
      split: splits
    })
  });

  // Clear form
  document.getElementById("paidBy").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("description").value = "";
  checkboxes.forEach(cb => cb.checked = false);
};
