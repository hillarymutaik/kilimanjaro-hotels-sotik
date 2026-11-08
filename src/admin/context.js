import { createContext, useContext } from 'react';

export const AdminContext = createContext(null);
/** { user, notify(message, type), go(page, param) } */
export const useAdmin = () => useContext(AdminContext);
