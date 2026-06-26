from extensions import db
from flask_login import UserMixin
from datetime import datetime 


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False)

class Department(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)

    items = db.relationship("Inventory", backref="department", lazy=True)


class Inventory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.String(50), unique=True, nullable=False)
    item_name = db.Column(db.String(120), nullable=False)
    price = db.Column(db.Float, nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("department.id"))
    sales_velocity = db.Column(db.Float, nullable=False)


class Sales(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.String, db.ForeignKey("inventory.item_id"))
    quantity = db.Column(db.Integer)
    price_at_sale = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class Restock(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.String, db.ForeignKey("inventory.item_id"), nullable=False)
    quantity_added = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    requested_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

class SkuChange(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.String, db.ForeignKey("inventory.item_id"), nullable=False)
    change_type = db.Column(db.String, nullable=False)
    change_detail = db.Column(db.String, nullable=True)  # "add" or "delete"
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    requested_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)




