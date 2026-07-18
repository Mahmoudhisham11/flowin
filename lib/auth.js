import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { app } from "./firebase";

const auth = getAuth(app);

export { auth, GoogleAuthProvider };
