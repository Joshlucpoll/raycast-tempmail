import { LocalStorage, environment, getPreferenceValues } from "@raycast/api";
import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";
import fs from "fs";
import EmlParser from "eml-parser";
import axios from "axios";

interface Auth {
  address: string;
  password: string;
}

interface Identity {
  id: string;
  token: string;
}

export interface Preferences {
  expiry_time: string;
}

async function createAuth() {
  const domains = await axios.get("https://api.mail.tm/domains");
  const auth: Auth = {
    address: `${uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals], separator: "-" })}-${Math.floor(
      Math.random() * (999 - 100 + 1) + 100
    )}@${domains.data["hydra:member"][0]["domain"]}`,
    password: Math.random().toString(36).slice(2, 15),
  };

  await LocalStorage.setItem("last_active", new Date().toISOString());
  await LocalStorage.setItem("authentication", JSON.stringify(auth));

  await axios.post("https://api.mail.tm/accounts", auth);

  return auth;
}

async function deleteAuth(auth: Auth) {
  const { id, token } = await getIdentity(auth);
  await axios.delete(`https://api.mail.tm/accounts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  await LocalStorage.removeItem("authentication");
  await LocalStorage.removeItem("identity");
}

async function getAuth() {
  let auth: Auth;
  const rawAuth = await LocalStorage.getItem("authentication");
  if (!rawAuth) {
    auth = await createAuth();
  } else {
    auth = JSON.parse(rawAuth as string);

    const expiry_time = parseInt(getPreferenceValues<Preferences>().expiry_time);

    if (!isNaN(expiry_time)) {
      const lastActive = (await LocalStorage.getItem("last_active")) as string;

      const now = new Date().getTime() / 60000;
      const authCreated = new Date(lastActive).getTime() / 60000;

      if (now - authCreated > expiry_time) {
        await deleteAuth(auth);
        auth = await createAuth();
      }
    }
  }

  return auth;
}

async function getIdentity(specificAuth?: Auth): Promise<Identity> {
  let auth: Auth;
  let storedIdentity: Identity;

  const rawIdentity = await LocalStorage.getItem("identity");
  if (rawIdentity) storedIdentity = JSON.parse(rawIdentity as string);

  if (specificAuth) auth = specificAuth;
  else if (storedIdentity) {
    return storedIdentity;
  } else auth = await getAuth();

  const res = await axios.post("https://api.mail.tm/token", auth);
  await LocalStorage.setItem("identity", JSON.stringify(res.data));

  return res.data;
}

export async function newAuth() {
  const rawAuth = await LocalStorage.getItem("authentication");
  if (rawAuth) {
    const currentAuth = JSON.parse(rawAuth as string);
    await deleteAuth(currentAuth);
  }
}

async function getGetMessages(token: string, page = 1) {
  const url = "https://api.mail.tm/messages" + (page ? `?page=${page}` : "");
  const messagesRes = await axios
    .get(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .catch(async (e) => {
      if (e.response.status == 401) await LocalStorage.removeItem("identity");
      throw Error("Token Expired");
    });

  if (
    messagesRes.data["hydra:totalItems"] <= 30 ||
    messagesRes.data["hydra:member"].length + (page - 1) * 30 == messagesRes.data["hydra:totalItems"]
  )
    return messagesRes.data["hydra:member"];

  return [getGetMessages(token, page + 1), ...messagesRes.data["hydra:member"]];
}

export async function getMailboxData() {
  const { token } = await getIdentity();

  const lastActive = new Date((await LocalStorage.getItem("last_active")) as string);
  const auth: Auth = JSON.parse((await LocalStorage.getItem("authentication")) as string);
  const messages = await getGetMessages(token);

  return { lastActive, currentAddress: auth.address, messages };
}

async function readEmail(id: string) {
  const { token } = await getIdentity();

  await axios
    .patch(
      `https://api.mail.tm/messages/${id}`,
      {
        seen: true,
      },
      {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/merge-patch+json" },
      }
    )
    .catch(async (e) => {
      if (e.response.status == 401) await LocalStorage.removeItem("identity");
      throw Error("Token Expired");
    });
}

export async function deleteEmail(id: string) {
  const { token } = await getIdentity();

  await axios
    .delete(`https://api.mail.tm/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .catch(async (e) => {
      if (e.response.status == 401) await LocalStorage.removeItem("identity");
      throw Error("Token Expired");
    });
}

export async function getMessage(id: string) {
  const { token } = await getIdentity();

  const messagesRes = await axios
    .get(`https://api.mail.tm/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .catch(async (e) => {
      if (e.response.status == 401) await LocalStorage.removeItem("identity");
      throw Error("Token Expired");
    });

  if (!messagesRes.data.seen) await readEmail(id);

  return messagesRes.data;
}

export async function createHTMLFile(emlPath: string) {
  const htmlPath = emlPath.replaceAll("eml", "html");
  const htmlDir = htmlPath
    .split("/")
    .splice(0, htmlPath.split("/").length - 1)
    .join("/");

  if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir, { recursive: true });
  }

  if (fs.existsSync(htmlPath)) {
    return htmlPath;
  }

  const emlFile = fs.createReadStream(emlPath);
  const htmlString = await new EmlParser(emlFile).getEmailAsHtml();

  fs.writeFileSync(htmlPath, htmlString);

  return htmlPath;
}

export async function downloadMessage(url: string): Promise<string> {
  const { token } = await getIdentity();

  const dirPath = `${environment.supportPath}/temp/eml`;
  const filePath = `${dirPath}/${url.split("/")[2]}.eml`;

  // create folder structure of `dirPath` if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // if attachment already exists return file path
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  const file = fs.createWriteStream(filePath);

  const response = await axios
    .get(`https://api.mail.tm${url}`, {
      responseType: "stream",
      headers: { Authorization: `Bearer ${token}` },
    })
    .catch(async (e) => {
      if (e.response.status == 401) await LocalStorage.removeItem("identity");
      throw Error("Token Expired");
    });

  return new Promise((resolve, reject) => {
    response.data.pipe(file);
    let error = null;
    file.on("error", (err) => {
      error = err;
      file.close();
      reject(err);
    });
    file.on("close", () => {
      if (!error) {
        resolve(filePath);
      }
    });
  });
}

export async function downloadAttachment({
  downloadUrl,
  filename,
  id,
  transferEncoding,
}: {
  downloadUrl: string;
  filename: string;
  id: string;
  transferEncoding: string;
}): Promise<string> {
  const { token } = await getIdentity();

  const dirPath = `${environment.supportPath}/temp/attachments/${id}`;
  const filePath = `${dirPath}/${filename}`;

  // create folder structure of `dirPath` if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // if attachment already exists return file path
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  const file = fs.createWriteStream(filePath, { encoding: transferEncoding as BufferEncoding });

  const response = await axios
    .get(`https://api.mail.tm${downloadUrl}`, {
      responseType: "stream",
      headers: { Authorization: `Bearer ${token}` },
    })
    .catch(async (e) => {
      if (e.response.status == 401) await LocalStorage.removeItem("identity");
      throw Error("Token Expired");
    });

  return new Promise((resolve, reject) => {
    response.data.pipe(file);
    let error = null;
    file.on("error", (err) => {
      error = err;
      file.close();
      reject(err);
    });
    file.on("close", () => {
      if (!error) {
        resolve(filePath);
      }
    });
  });
}
