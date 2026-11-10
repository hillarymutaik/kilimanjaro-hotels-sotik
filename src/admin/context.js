import { createContext, useContext } from 'react';

/** The public website's home page (respects the GitHub Pages base path). */
export const SITE_HOME = import.meta.env.BASE_URL;

export const AdminContext = createContext(null);
/** { user, notify(message, type), go(page, param), logout(), theme, setTheme(pref) } */
export const useAdmin = () => useContext(AdminContext);
