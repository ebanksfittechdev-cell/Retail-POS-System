import os
from flask import Blueprint, jsonify, send_from_directory, render_template, request, abort, redirect, flash, url_for, current_app 
from models import db, User, Inventory, Sales, Restock, Department, SkuChange
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, login_required, current_user, logout_user
import random
from sale_sim import simulate_sale
from datetime import datetime, timedelta
from extensions import limiter
from threading import Thread
import time 

# Create a Blueprint for routes
main_routes = Blueprint("main_routes", __name__)
ALLOWED_ROLES = {"Manager", "Department Manager", "Employee"}
MAX_ORDER_QUANTITY = 500
MAX_STOCK_AMOUNT = 500
MAX_PRICE = 999.99
MAX_SKU_COUNT = 100

@main_routes.errorhandler(403)
def forbidden(e):
    return render_template("403.html"), 403

#role based access controls
def role_required(*roles):
    """Decorator to restrict access to users with specific roles."""
    def wrapper(fn):

        @login_required
        def decorated_view(*args, **kwargs):

            # First: ensure the user's role is even valid
            if current_user.role not in ALLOWED_ROLES:
                abort(403)

            # Second: enforce route‑specific roles
            if roles and current_user.role not in roles:
                abort(403)

            return fn(*args, **kwargs)

        decorated_view.__name__ = fn.__name__
        return decorated_view

    return wrapper


#url routes
@main_routes.route('/')
def login():
    return render_template('login.html')

@main_routes.route("/revenue")
@role_required('Employee', 'Department Manager', 'Manager')
def revenue():
    return render_template("revenue.html")

@main_routes.route('/movement')
@role_required('Employee', 'Department Manager', 'Manager')
def movement():
    return render_template('movement.html')

@main_routes.route('/order_placement')
@role_required('Department Manager', 'Manager')
def order_placement():
    return render_template('order_placement.html')

@main_routes.route('/update')
@role_required('Manager')
def update():
    return render_template('update.html')

@main_routes.route('/settings')
@role_required('Employee', 'Department Manager', 'Manager')
def settings():
    return render_template('settings.html')

@main_routes.route('/audit_log')
@role_required('Department Manager', 'Manager')
def audit_log():
    return render_template('audit_log.html')


# register route
@main_routes.post("/api/register")
def register():

    if os.environ.get("ALLOW_REGISTRATION", "false").lower() != "true":
        return jsonify({"message": "Registration is disabled for this demo"}), 403
    
    data = request.get_json()

    username = data.get("username")
    password = data.get("password")
    role = data.get("role")

    allowed_roles = {"Manager", "Department Manager", "Employee"}

    if role not in allowed_roles:
        return jsonify({"message": "Invalid role"}), 400

    if not username or not password or not role:
        return jsonify({"message": "Username, password, and role are required"}), 400

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({"message": "Username already exists"}), 409

    user = User(
        username=username,
        password_hash=generate_password_hash(password),
        role=role,
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201

#login route
@main_routes.post('/api/login')
@limiter.limit("10 per hour")
def api_login():
    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    user = User.query.filter_by(username=username).first()

    if not user:
        return jsonify({"message": "Invalid username or password"}), 401

    if not check_password_hash(user.password_hash, password):
        return jsonify({"message": "Invalid username or password"}), 401

    login_user(user)

    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role
        }
    }), 200

#settings routes

@main_routes.route("/api/logout", methods=["POST"])
@limiter.limit("10 per minute")
@login_required
def api_logout():
    logout_user()
    return jsonify({"message": "Logged out"}), 200


@main_routes.route("/api/delete_account", methods=["DELETE"])
@login_required
def api_delete_account():
    if os.environ.get("ALLOW_REGISTRATION", "false").lower() != "true":
        return jsonify({"message": "Registration is disabled for this demo"}), 403
    
    try:
        user = User.query.get(current_user.id)
        if user is None:
            return jsonify({"error": "User not found"}), 404

        logout_user()
        db.session.delete(user)
        db.session.commit()

        return jsonify({"message": "Account deleted"}), 200

    except Exception:
        db.session.rollback()
        return jsonify({"error": "Server error"}), 500

#main dashboard routes
@main_routes.route("/api/revenue")
@login_required
def api_revenue():
    department = request.args.get("department")
    sort = request.args.get("sort", "desc")
    sku = request.args.get("sku")
    search = request.args.get("search")


    days_ago = datetime.utcnow() - timedelta(days=30)

    query = (
        db.session.query(
            Inventory.item_name,
            Department.name.label("department"),
            db.func.sum(Sales.quantity * Sales.price_at_sale).label("revenue")
        )
        .join(Inventory, Sales.item_id == Inventory.item_id)
        .join(Department, Inventory.department_id == Department.id)
        .filter(Sales.timestamp >= days_ago)
        .filter(Inventory.is_active == True)
    )

    if department:
        query = query.filter(Department.name == department)

    if sku:
        query = query.filter(Inventory.item_id == sku)
    if search:
        query = query.filter(Inventory.item_name.ilike(f"%{search}%"))


    query = query.group_by(Inventory.item_name, Department.name)

    if sort == "asc":
        query = query.order_by(db.asc("revenue"))
    else:
        query = query.order_by(db.desc("revenue"))

    results = query.all()

    return jsonify([
        {
            "item_name": r.item_name,
            "department": r.department,
            "revenue": float(r.revenue)
        }
        for r in results
    ])

#simulates sale through repeated clicks
@main_routes.route("/api/simulate", methods=["POST"])
@limiter.limit("50 per hour")
@login_required
def simulate():
    simulate_sale()
    return jsonify(status="ok")




# movement routes
@main_routes.route("/api/movement")
@login_required
def api_movement():
    search = request.args.get("search")
    department = request.args.get("department")
    sort = request.args.get("sort", "asc")  # default lowest stock first

    query = (
        db.session.query(
            Inventory.item_id,
            Inventory.item_name,
            Inventory.amount,
            Inventory.price, 
            Department.name.label("department")
        )
        .join(Department, Inventory.department_id == Department.id)
        .filter(Inventory.is_active == True)
    )

    if department:
        query = query.filter(Department.name == department)
    if search:
        query = query.filter(Inventory.item_name.ilike(f"%{search}%"))

    if sort == "asc":
        query = query.order_by(db.asc(Inventory.amount))
    else:
        query = query.order_by(db.desc(Inventory.amount))

    results = query.all()

    return jsonify([
    {
        "item_id": r.item_id,
        "item_name": r.item_name,
        "amount": r.amount,
        "price": r.price,
        "department": r.department
    }
    for r in results
])


# order route — add to your main_routes blueprint

@main_routes.route("/api/place_order", methods=["POST"])
@limiter.limit("10 per minute")
@role_required("Department Manager", "Manager")
def place_order():
    data = request.get_json()

    item_id  = data.get("item_id")
    quantity = data.get("quantity")
    

    if not item_id or not quantity:
        return jsonify({"status": "error", "message": "item_id and quantity are required"}), 400

    try:
        quantity = int(quantity)
        if quantity <= 0:
            raise ValueError
        if quantity > MAX_ORDER_QUANTITY:
            return jsonify({"status": "error", "message": "Quantity is too large"}), 400
        
   
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Quantity must be a positive integer"}), 400

    item = Inventory.query.filter_by(item_id=item_id, is_active=True).first()
    if not item:
        return jsonify({"status": "error", "message": "Item not found"}), 404

    
    if item.amount + quantity > MAX_STOCK_AMOUNT:
        return jsonify({"status": "error", "message": "Stock amount is too large"}), 400

    
    item.amount += quantity



    # Log restock
    restock = Restock(
        item_id=item_id,
        quantity_added=quantity,
        requested_by=current_user.id
    )
    
    
    db.session.add(restock)
    db.session.commit()

    return jsonify({
        "status": "success",
        "item_id": item.item_id,
        "item_name": item.item_name,
        "quantity_added": quantity,
        "new_stock": item.amount
    }), 200




# SKU management routes — add to your main_routes blueprint
# Requires: from flask_login import login_required, current_user

DEPT_PREFIXES = {
    "Produce": "PRO",
    "Bakery":  "BAK",
    "Frozen":  "FRZ"
}


@main_routes.route("/api/update_sku", methods=["POST"])
@limiter.limit("10 per minute")
@role_required("Manager")
def update_sku():
    data = request.get_json()

    item_id   = data.get("item_id")
    item_name = data.get("item_name")
    price     = data.get("price")
    amount    = data.get("amount")


    if not item_id:
        return jsonify({"status": "error", "message": "item_id is required"}), 400

    item = Inventory.query.filter_by(item_id=item_id, is_active=True).first()
    if not item:
        return jsonify({"status": "error", "message": "Item not found"}), 404

    changes = []
    
    if item_name is not None:
        item_name = str(item_name).strip()
        if not item_name:
            return jsonify({"status": "error", "message": "Item name cannot be empty"}), 400
        if item_name != item.item_name:
            changes.append(f"name: {item.item_name} -> {item_name}")
        item.item_name = item_name

    if price is not None:
        try:
            price = round(float(price), 2)
            if price < 0:
                raise ValueError
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Price must be a positive number"}), 400
        if price > MAX_PRICE:
            return jsonify({"status": "error", "message": "Price is too large"}), 400
        if price != item.price:
            changes.append(f"price: {item.price} -> {price}")
        item.price = price

    if amount is not None:
        try:
            amount = int(amount)
            if amount < 0:
                raise ValueError
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Stock must be a non-negative integer"}), 400
        if amount > MAX_STOCK_AMOUNT:
            return jsonify({"status": "error", "message": "Stock amount is too large"}), 400
    
        if amount != item.amount:
            changes.append(f"stock: {item.amount} -> {amount}")
        item.amount = amount

    if changes:
        change = SkuChange(
            item_id=item.item_id,
            change_type="update",
            change_detail=", ".join(changes),
            requested_by=current_user.id
        )
        db.session.add(change)

    db.session.commit()

    return jsonify({
        "status": "success",
        "item_id": item.item_id,
        "item_name": item.item_name,
        "price": item.price,
        "amount": item.amount
    }), 200


@main_routes.route("/api/deactivate_sku", methods=["POST"])
@limiter.limit("5 per minute")
@role_required("Manager")
def deactivate_sku():
    data = request.get_json()

    item_id = data.get("item_id")
    if not item_id:
        return jsonify({"status": "error", "message": "item_id is required"}), 400

    item = Inventory.query.filter_by(item_id=item_id, is_active=True).first()
    if not item:
        return jsonify({"status": "error", "message": "Item not found or already inactive"}), 404

    change = SkuChange(
        item_id=item.item_id,
        change_type="delete",
        requested_by=current_user.id
    )
    db.session.add(change)

    item.is_active = False
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": f"{item.item_name} has been deactivated."
    }), 200


@main_routes.route("/api/add_sku", methods=["POST"])
@limiter.limit("5 per minute")
@role_required("Manager")
def add_sku():
    """Add a new SKU. Backend auto-generates the item_id from the department prefix."""
    data = request.get_json()

    item_name  = data.get("item_name", "").strip()
    price      = data.get("price")
    amount     = data.get("amount")
    dept_name  = data.get("department", "").strip()

    if Inventory.query.filter_by(is_active=True).count() >= MAX_SKU_COUNT:
        return jsonify({"status": "error", "message": "SKU limit reached"}), 400
    # Validate required fields
    if not item_name:
        return jsonify({"status": "error", "message": "Item name is required"}), 400
    if not dept_name:
        return jsonify({"status": "error", "message": "Department is required"}), 400

    try:
        price = float(price)
        if price < 0:
            raise ValueError
        if price > MAX_PRICE:
            return jsonify({"status": "error", "message": "Price is too large"}), 400
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Price must be a positive number"}), 400

    try:
        amount = int(amount)
        if amount < 0:
            raise ValueError
        if amount > MAX_STOCK_AMOUNT:
            return jsonify({"status": "error", "message": "Stock amount is too large"}), 400
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Quantity must be a non-negative integer"}), 400

    department = Department.query.filter_by(name=dept_name).first()
    if not department:
        return jsonify({"status": "error", "message": "Department not found"}), 404

    prefix = DEPT_PREFIXES.get(dept_name)
    if not prefix:
        return jsonify({"status": "error", "message": "No SKU prefix configured for this department"}), 400

    # Auto-generate next SKU ID for this department
    last = Inventory.query.filter(
        Inventory.item_id.like(f"{prefix}-%")
    ).order_by(Inventory.item_id.desc()).first()

    if last:
        try:
            last_num = int(last.item_id.split("-")[1])
        except (IndexError, ValueError):
            last_num = 0
        new_id = f"{prefix}-{str(last_num + 1).zfill(3)}"
    else:
        new_id = f"{prefix}-001"

    # Guard against race condition duplicates
    if Inventory.query.filter_by(item_id=new_id).first():
        return jsonify({"status": "error", "message": "SKU ID conflict. Please try again."}), 409

    new_item = Inventory(
        item_id=new_id,
        item_name=item_name,
        price=round(price, 2),
        amount=amount,
        sales_velocity=0.05,  # default velocity — can be updated later
        is_active=True,
        department_id=department.id
    )
    db.session.add(new_item)

    # Log to SkuChange
    change = SkuChange(
        item_id=new_id,
        change_type="add",
        requested_by=current_user.id
    )
    db.session.add(change)
    db.session.commit()

    return jsonify({
        "status": "success",
        "item_id": new_id,
        "item_name": item_name,
        "price": round(price, 2),
        "amount": amount,
        "department": dept_name
    }), 201


# audit log route — add to your main_routes blueprint

@main_routes.route("/api/audit")
@login_required
def api_audit():
    table = request.args.get("table", "sku")        # "sku" or "restock"
    change_type = request.args.get("change_type")         # "add", "delete", "update"

    if table == "restock":
        query = (
            db.session.query(
                Restock.item_id,
                Inventory.item_name,
                Restock.quantity_added,
                Restock.timestamp,
                User.username.label("requested_by")
            )
            .join(Inventory, Restock.item_id == Inventory.item_id)
            .join(User, Restock.requested_by == User.id)
            .order_by(db.desc(Restock.timestamp))
        )

        results = query.all()

        return jsonify([
            {
                "item_id":        r.item_id,
                "item_name":      r.item_name,
                "quantity_added": r.quantity_added,
                "timestamp":      r.timestamp.strftime("%b %d, %Y %I:%M %p"),
                "requested_by":   r.requested_by
            }
            for r in results
        ])

    else:
        # Default: SkuChange table
        query = (
            db.session.query(
                SkuChange.item_id,
                Inventory.item_name,
                SkuChange.change_type,
                SkuChange.change_detail,
                SkuChange.timestamp,
                User.username.label("requested_by")
            )
            .join(Inventory, SkuChange.item_id == Inventory.item_id)
            .join(User, SkuChange.requested_by == User.id)
            .order_by(db.desc(SkuChange.timestamp))
        )

        if change_type:
            query = query.filter(SkuChange.change_type == change_type)

        results = query.all()
        
        return jsonify([
            {
                "item_id":       r.item_id,
                "item_name":     r.item_name,
                "change_type":   r.change_type,
                "change_detail": r.change_detail or "—",
                "timestamp":     r.timestamp.strftime("%b %d, %Y %I:%M %p"),
                "requested_by":  r.requested_by
            }
            for r in results
        ])

    
    


