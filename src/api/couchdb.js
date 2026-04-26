import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { getAppDbBase } from "../config/couchdb";

/**
 * Example env:
 *  REACT_APP_COUCHDB_URL=http://diperi.home/couchdb
 *  REACT_APP_COUCHDB_DB=local-task-tracker
 */
const BASE = getAppDbBase();
// => "http://diperi.home/couchdb/local-task-tracker"

/** Fetch a doc by ID */
export async function getDoc(docId) {
  return axios
    .get(`${BASE}/${encodeURIComponent(docId)}`)
    .then((res) => res.data);
}

/** Create/update doc by ID (PUT) */
export async function putDoc(doc) {
  if (!doc._id) {
    doc._id = `doc:${uuidv4()}`;
  }
  const res = await axios.put(`${BASE}/${encodeURIComponent(doc._id)}`, doc);
  return res.data;
}

/** Mango query helper: POST /_find */
export async function findDocs(selector, fields = null) {
  const body = { selector };
  if (fields) body.fields = fields;
  const res = await axios.post(`${BASE}/_find`, body);
  return res.data.docs;
}

/** Delete doc if you have _id + _rev */
export async function deleteDoc(doc) {
  if (!doc._id || !doc._rev) {
    throw new Error("deleteDoc() requires _id and _rev");
  }
  await axios.delete(`${BASE}/${encodeURIComponent(doc._id)}?rev=${doc._rev}`);
}

/** Example: increment user coins (non-transactional) */
export async function incrementUsercoins(userId, inc) {
  const userDoc = await getDoc(userId);
  userDoc.coins = (userDoc.coins || 0) + inc;
  return putDoc(userDoc);
}
