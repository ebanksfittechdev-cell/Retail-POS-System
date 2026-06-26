document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logout-btn");
    const deleteBtn = document.getElementById("delete-account-btn");
    const messageBox = document.getElementById("settings-message");

    // Logout Request
    logoutBtn.addEventListener("click", async () => {
        const res = await fetch("/api/logout", {
            method: "POST",
            credentials: "include"
        });

        if (res.ok) {
            window.location.href = "/";
        } else {
            messageBox.textContent = "Failed to log out.";
        }
    });

    // Delete Account Request
    deleteBtn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete your account? This cannot be undone.")) {
            return;
        }

        const res = await fetch("/api/delete_account", {
            method: "DELETE",
            credentials: "include"
        });

        if (res.ok) {
            window.location.href = "/";
        } else {
            messageBox.textContent = "Failed to delete account.";
        }
    });
});

