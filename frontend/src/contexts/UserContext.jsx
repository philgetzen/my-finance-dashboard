import React, { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        // Logic to fetch user ID or authentication state
        const fetchUserId = async () => {
            // Example: Fetch user ID from an API or local storage
            const id = await getUserIdFromAPI(); // Replace with your logic
            setUserId(id);
        };

        fetchUserId();
    }, []);

    return (
        <UserContext.Provider value={{ userId }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUserContext = () => {
    return useContext(UserContext);
};

export { UserContext };
