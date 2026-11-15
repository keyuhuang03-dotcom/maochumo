import { getSession } from "../../core/session";
export const isLoggedIn = () => !!getSession();
export const isAdmin = () => getSession()?.user.role === "admin";
