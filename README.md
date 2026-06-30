# Retail POS System

A full-stack retail point-of-sale and inventory management system built with Flask, SQLAlchemy, and vanilla JavaScript. Simulates real-world store operations including live sales, stock movement, shipment orders, SKU management, and a role-based audit log.

**Live demo:** _add your Render URL here_

Demo accounts (seeded automatically on first run):

| Username             | Password  | Role               |
|----------------------|-----------|--------------------|
| employee_demo        | demo123   | Employee           |
| dept_manager_demo    | demo123   | Department Manager |
| manager_demo         | demo123   | Manager            |

---

## Overview

This project simulates a multi-department retail store (Produce, Bakery, Frozen) with role-based access for employees, department managers, and store managers. It includes live sales simulation, real-time stock tracking, shipment ordering, SKU lifecycle management, and a full audit trail of every change made to inventory.

The database resets automatically every 24 hours so the demo environment always has fresh, explorable data.

## Features

**Revenue Dashboard** — 30-day revenue breakdown by item and department, with search, sorting, and a live bar chart powered by Chart.js.

**Stock Movement** — current inventory levels across all departments with low-stock alerts (highlighted in red below a configurable threshold).

**Order Placement** — managers and department managers can place shipment orders on any item. Orders simulate a real delivery delay before stock updates.

**SKU Management** — store managers can update item names, prices, and stock levels inline, soft-delete discontinued items, and add new SKUs. SKU IDs are auto-generated per department (e.g. `FRZ-021`) to prevent collisions or manual entry errors.

**Audit Log** — a complete, timestamped history of every SKU addition, deletion, update, and shipment order, attributed to the user who performed it.

**Role-Based Access Control** — routes are protected by role (Employee, Department Manager, Manager) with rate limiting on write operations.

**Soft Deletes** — deactivated items are never hard-deleted, preserving referential integrity for the audit log and historical sales data.

## Tech Stack

**Backend:** Flask, Flask-SQLAlchemy, Flask-Login, Flask-Limiter, APScheduler
**Database:** PostgreSQL (production), SQLite (local development)
**Frontend:** Vanilla JavaScript, Jinja2, Chart.js
**Deployment:** Render, Gunicorn

## Architecture Notes

The frontend is built without a framework — each dashboard page (`revenue.js`, `movement.js`, `orders.js`, `update.js`, `audit.js`) follows the same pattern: a single `state` object holds the current view's data and filters, one function handles all API communication, and rendering functions read directly from `state` to update the DOM. No page stores more state than it needs, and no UI updates happen outside of the render cycle.

Money and inventory changes are never trusted from the frontend beyond input — SKU IDs are server-generated, role checks are enforced server-side via decorators, and every write to inventory is logged to either the `Restock` or `SkuChange` table with the acting user attached.

## Local Setup

```bash
git clone https://github.com/yourusername/retail-pos-system.git
cd retail-pos-system
python -m venv env
env\Scripts\activate        # Windows
source env/bin/activate     # macOS/Linux
pip install -r requirements.txt
python app.py
```

The app will create and seed the database automatically on first run.

## Environment Variables

| Variable        | Description                          | Default                |
|------------------|--------------------------------------|-------------------------|
| `SECRET_KEY`     | Flask session secret                 | `dev-secret-key`        |
| `DATABASE_URL`   | Database connection string           | `sqlite:///POS.db`      |

In production, both should be set explicitly — never deploy with the default secret key.

## Database Models

- **User** — authentication and role assignment
- **Department** — Produce, Bakery, Frozen
- **Inventory** — item catalog with price, stock, department, and active status
- **Sales** — individual sale transactions used for revenue reporting
- **Restock** — shipment order history
- **SkuChange** — audit log of additions, deletions, and updates to inventory items

## Future Improvements

- WebSocket-based live updates for the revenue and stock dashboards
- Pagination for large inventories
- Department-scoped permissions (currently any manager can act on any department, mirroring how many real retail environments operate, with accountability enforced through the audit log instead of access restrictions)