/**
 * Supabase Authentication & Database Initialization
 * Uses native ESM import tied directly to your NPM tree.
 */
import { createClient } from '@supabase/supabase-js';


// Safely pull from Vite environment variables, fallback to local error string if not built
const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || "REPLACE_WITH_SUPABASE_ANON_KEY";

export function initSupabaseAuth(onDashboardReady) {
    const loginScreen = document.getElementById('supabaseLoginScreen');
    const dashboardApp = document.getElementById('tipDashboardApp');
    const loginBtn = document.getElementById('spLoginBtn');
    const errorEl = document.getElementById('spLoginError');

    // Initialize client via NPM package directly!
    let supabaseClient;
    try {
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Expose globally for queries purely as a convenience
        window.tipDB = supabaseClient;
    } catch (err) {
        console.error("Supabase config error:", err);
    }

    const grantAccess = (user) => {
        if (loginScreen) loginScreen.style.display = 'none';
        if (dashboardApp) dashboardApp.style.display = 'flex';
        
        const uName = document.querySelector('.user-name');
        const uAvatar = document.querySelector('.user-avatar');
        if (uName) uName.textContent = user?.user_metadata?.full_name || user?.email || "Admin User";
        if (uAvatar) {
            const letter = (user?.user_metadata?.full_name || user?.email || 'A').charAt(0).toUpperCase();
            uAvatar.textContent = letter;
        }
        
        // Trigger dashboard mounting
        if (typeof onDashboardReady === 'function') {
            onDashboardReady();
        }
    };

    const denyAccess = () => {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (dashboardApp) dashboardApp.style.display = 'none';
    };

    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (session && session.user) grantAccess(session.user);
            else denyAccess();
        });

        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (session && session.user) grantAccess(session.user);
            else denyAccess();
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const originalHtml = loginBtn.innerHTML;
            loginBtn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid;border-color:#3c4043 transparent #3c4043 transparent;border-radius:50%;animation:spin 1s linear infinite;"></span> Redirecting...';
            loginBtn.disabled = true;

            if (!supabaseClient || SUPABASE_ANON_KEY.includes("REPLACE") || SUPABASE_ANON_KEY === "your_anon_key") {
                showDevBypassError();
                loginBtn.innerHTML = originalHtml;
                loginBtn.disabled = false;
                return;
            }

            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.href }
            });

            if (error) {
                if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = error.message; }
                loginBtn.innerHTML = originalHtml;
                loginBtn.disabled = false;
            }
        });
    }

    // --- Developer bypass injection ---
    function showDevBypassError() {
        if (!errorEl) return;
        errorEl.style.display = 'block';
        errorEl.innerHTML = "<strong>Missing .env Config!</strong><br>Set actual keys in `.env` to connect to database.<br><br><span style='color:#1a73e8;cursor:pointer;text-decoration:underline;' id='bypassDev'>[Dev Bypass: Auto Login]</span>";
        setTimeout(() => {
            const bypass = document.getElementById('bypassDev');
            if(bypass) bypass.onclick = () => grantAccess({ email: "local.dev@tested.com" });
        }, 100);
    }

    // --- View Toggling ---
    const signInBox = document.getElementById('signInBox');
    const signUpBox = document.getElementById('signUpBox');
    const showSignupBtn = document.getElementById('showSignupBtn');
    const showSigninBtn = document.getElementById('showSigninBtn');

    if (showSignupBtn) showSignupBtn.addEventListener('click', () => { signInBox.style.display = 'none'; signUpBox.style.display = 'block'; });
    if (showSigninBtn) showSigninBtn.addEventListener('click', () => { signUpBox.style.display = 'none'; signInBox.style.display = 'block'; });

    // --- Email & Password Interceptors ---
    const emailAuthForm = document.getElementById('emailAuthForm');
    const emailSignupForm = document.getElementById('emailSignupForm');

    if (emailAuthForm) {
        emailAuthForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const submitBtn = document.getElementById('emailLoginBtn');
            
            const originalHtml = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid;border-color:#fff transparent #fff transparent;border-radius:50%;animation:spin 1s linear infinite;"></span>...';
            submitBtn.disabled = true;

            if (!supabaseClient || SUPABASE_ANON_KEY.includes("REPLACE") || SUPABASE_ANON_KEY === "your_anon_key") {
                showDevBypassError();
                submitBtn.innerHTML = originalHtml;
                submitBtn.disabled = false;
                return;
            }

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = error.message; }
                submitBtn.innerHTML = originalHtml;
                submitBtn.disabled = false;
            }
        });
    }

    if (emailSignupForm) {
        emailSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const name = document.getElementById('regName').value;
            const submitBtn = document.getElementById('finalSignupBtn');
            const errorElSignup = document.getElementById('spSignupError');

            const originalHtml = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid;border-color:#fff transparent #fff transparent;border-radius:50%;animation:spin 1s linear infinite;"></span>...';
            submitBtn.disabled = true;

            if (!supabaseClient || SUPABASE_ANON_KEY.includes("REPLACE") || SUPABASE_ANON_KEY === "your_anon_key") {
                showDevBypassError();
                submitBtn.innerHTML = originalHtml;
                submitBtn.disabled = false;
                return;
            }

            const { data, error } = await supabaseClient.auth.signUp({ 
                email, 
                password,
                options: {
                    data: { full_name: name }
                }
            });
            
            if (error) {
                if (errorElSignup) { errorElSignup.style.display = 'block'; errorElSignup.textContent = error.message; }
                submitBtn.innerHTML = originalHtml;
                submitBtn.disabled = false;
            } else {
                if (errorElSignup) { 
                    errorElSignup.style.display = 'block'; 
                    errorElSignup.style.background = '#e6f4ea'; 
                    errorElSignup.style.color = '#1e8e3e'; 
                    errorElSignup.innerHTML = "Success! Please check your email or Sign In."; 
                }
                submitBtn.innerHTML = originalHtml;
                submitBtn.disabled = false;
                
                // Switch back to login page auto after 3s
                setTimeout(() => {
                    if (showSigninBtn) showSigninBtn.click();
                }, 3000);
            }
        });
    }
}
