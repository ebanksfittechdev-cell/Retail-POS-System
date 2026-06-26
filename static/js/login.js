const API = ''

// Toggle between login and register
document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault()
    document.getElementById('loginSection').classList.add('hidden')
    document.getElementById('registerSection').classList.remove('hidden')
})

document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault()
    document.getElementById('registerSection').classList.add('hidden')
    document.getElementById('loginSection').classList.remove('hidden')
})

// Login
document.getElementById('loginBtn').addEventListener('click', async () => {
    const username = document.getElementById('loginUsername').value
    const password = document.getElementById('loginPassword').value

    const res = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
})

    const data = await res.json()

    if (res.ok) {
        window.location.href = '/revenue'
    } else {
        document.getElementById('loginError').textContent = data.message
    }
})

// Register
document.getElementById('registerBtn').addEventListener('click', async () => {
    const username = document.getElementById('regUsername').value
    const password = document.getElementById('regPassword').value
    const selectedRole = document.querySelector('input[name="role"]:checked')

    if (!selectedRole) {
        document.getElementById('registerError').textContent = 'Please select a role'
        return
    }

    const role = selectedRole.value

    const res = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
    })

    const data = await res.json()

    if (res.ok) {
        // switch back to login after successful registration
        document.getElementById('registerSection').classList.add('hidden')
        document.getElementById('loginSection').classList.remove('hidden')
        document.getElementById('loginError').textContent = ''
        document.getElementById('registerError').textContent = ''
    } else {
        document.getElementById('registerError').textContent = data.message
    }
})