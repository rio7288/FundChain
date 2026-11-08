import { supabase } from "./supabase";

// REGISTER
export async function registerUser({
    email,
    password,
    username,
    fullName
}) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username,
                full_name: fullName
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`
        }
    });

    if (error) throw error;

    return data;
}

// LOGIN
export async function loginUser(email, password) {
    const { data, error } =
        await supabase.auth.signInWithPassword({
            email,
            password
        });

    if (error) throw error;

    return data;
}

// LOGOUT
export async function logoutUser() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;
}

// GET CURRENT USER
export async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error) throw error;

    return data.user;
}

// RESET PASSWORD EMAIL
export async function forgotPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(
        email,
        {
            redirectTo: `${window.location.origin}/reset-password`
        }
    );

    if (error) throw error;
}

// UPDATE PASSWORD
export async function updatePassword(password) {
    const { error } = await supabase.auth.updateUser({
        password
    });

    if (error) throw error;
}