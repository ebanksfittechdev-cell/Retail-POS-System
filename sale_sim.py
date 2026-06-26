from models import Inventory, Department, Sales
from extensions import db
import random

def seed_inventory():
    if Inventory.query.first():
        return

    # Create departments
    departments = {
        "Produce": Department(name="Produce"),
        "Bakery": Department(name="Bakery"),
        "Frozen": Department(name="Frozen")
    }

    for d in departments.values():
        db.session.add(d)

    db.session.commit()

    # FULL ITEM LIST (SKU, name, price, amount, velocity, department)
    items = [
        # Produce
        ("PRO-001", "Bananas",              0.69,  120, 0.12, "Produce"),
        ("PRO-002", "Apples",               0.99,   95, 0.10, "Produce"),
        ("PRO-003", "Oranges",              1.09,   80, 0.08, "Produce"),
        ("PRO-004", "Strawberries",         3.49,   60, 0.09, "Produce"),
        ("PRO-005", "Blueberries",          4.29,   50, 0.07, "Produce"),
        ("PRO-006", "Grapes",               2.99,   70, 0.08, "Produce"),
        ("PRO-007", "Broccoli",             1.79,   85, 0.07, "Produce"),
        ("PRO-008", "Carrots",              1.29,   90, 0.09, "Produce"),
        ("PRO-009", "Spinach",              2.49,   65, 0.06, "Produce"),
        ("PRO-010", "Romaine Lettuce",      1.99,   75, 0.08, "Produce"),
        ("PRO-011", "Cherry Tomatoes",      3.29,   55, 0.07, "Produce"),
        ("PRO-012", "Cucumbers",            0.99,   80, 0.08, "Produce"),
        ("PRO-013", "Bell Peppers",         1.49,   70, 0.07, "Produce"),
        ("PRO-014", "Yellow Onions",        0.89,  100, 0.10, "Produce"),
        ("PRO-015", "Garlic",               0.79,   90, 0.09, "Produce"),
        ("PRO-016", "Russet Potatoes",      3.99,   75, 0.08, "Produce"),
        ("PRO-017", "Sweet Potatoes",       1.29,   65, 0.06, "Produce"),
        ("PRO-018", "Avocados",             1.49,   85, 0.10, "Produce"),
        ("PRO-019", "Lemons",               0.79,   95, 0.08, "Produce"),
        ("PRO-020", "Kale",                 2.29,   50, 0.05, "Produce"),

        # Bakery
        ("BAK-001", "Sourdough Loaf",       4.99,   40, 0.06, "Bakery"),
        ("BAK-002", "Whole Wheat Bread",    3.49,   55, 0.08, "Bakery"),
        ("BAK-003", "Bagels 6-Pack",        3.99,   45, 0.07, "Bakery"),
        ("BAK-004", "Croissants 4-Pack",    5.49,   35, 0.05, "Bakery"),
        ("BAK-005", "Blueberry Muffins",    4.29,   40, 0.06, "Bakery"),
        ("BAK-006", "Cinnamon Rolls 4-Pack",5.99,   30, 0.05, "Bakery"),
        ("BAK-007", "Baguette",             2.49,   50, 0.07, "Bakery"),
        ("BAK-008", "Rye Bread",            4.49,   35, 0.04, "Bakery"),
        ("BAK-009", "Multigrain Loaf",      4.29,   40, 0.05, "Bakery"),
        ("BAK-010", "Chocolate Chip Cookies",3.99,  45, 0.07, "Bakery"),
        ("BAK-011", "Pita Bread 6-Pack",    2.99,   50, 0.06, "Bakery"),
        ("BAK-012", "Focaccia",             5.29,   25, 0.04, "Bakery"),
        ("BAK-013", "English Muffins 6-Pack",3.29,  55, 0.07, "Bakery"),
        ("BAK-014", "Pretzel Rolls 4-Pack", 4.49,   30, 0.05, "Bakery"),
        ("BAK-015", "Banana Bread Loaf",    5.49,   25, 0.04, "Bakery"),
        ("BAK-016", "Dinner Rolls 8-Pack",  3.49,   45, 0.06, "Bakery"),
        ("BAK-017", "Pumpernickel Loaf",    4.79,   20, 0.03, "Bakery"),
        ("BAK-018", "Cheese Danish",        2.99,   35, 0.05, "Bakery"),
        ("BAK-019", "Brioche Loaf",         5.99,   25, 0.04, "Bakery"),
        ("BAK-020", "Honey Oat Bread",      4.19,   40, 0.05, "Bakery"),

        # Frozen
        ("FRZ-001", "Frozen Pizza Margherita",   7.99,  35, 0.06, "Frozen"),
        ("FRZ-002", "Frozen Pepperoni Pizza",    8.49,  40, 0.07, "Frozen"),
        ("FRZ-003", "Chicken Tenders 2lb",       9.99,  30, 0.05, "Frozen"),
        ("FRZ-004", "Frozen Waffles 10-Pack",    4.29,  50, 0.08, "Frozen"),
        ("FRZ-005", "Frozen Burritos 4-Pack",    5.99,  35, 0.06, "Frozen"),
        ("FRZ-006", "Frozen Mac & Cheese",       3.49,  45, 0.07, "Frozen"),
        ("FRZ-007", "Frozen Edamame 12oz",       3.29,  40, 0.06, "Frozen"),
        ("FRZ-008", "Fish Sticks 24oz",          6.49,  30, 0.04, "Frozen"),
        ("FRZ-009", "Frozen Meatballs 2lb",      8.99,  25, 0.04, "Frozen"),
        ("FRZ-010", "Frozen Corn 12oz",          2.49,  60, 0.08, "Frozen"),
        ("FRZ-011", "Frozen Peas 16oz",          2.29,  60, 0.08, "Frozen"),
        ("FRZ-012", "Frozen Broccoli Florets",   2.99,  55, 0.07, "Frozen"),
        ("FRZ-013", "Ice Cream Vanilla 1.5qt",   5.99,  40, 0.06, "Frozen"),
        ("FRZ-014", "Ice Cream Chocolate 1.5qt", 5.99,  40, 0.06, "Frozen"),
        ("FRZ-015", "Frozen Hash Browns 2lb",    4.49,  35, 0.05, "Frozen"),
        ("FRZ-016", "Frozen Garlic Bread",       4.29,  28, 0.03, "Frozen"),
        ("FRZ-017", "Frozen Shrimp 1lb",         9.99,  20, 0.03, "Frozen"),
        ("FRZ-018", "Frozen Pot Pie Chicken",    3.99,  35, 0.05, "Frozen"),
        ("FRZ-019", "Frozen Breakfast Sandwich", 4.79,  30, 0.05, "Frozen"),
        ("FRZ-020", "Frozen Stir Fry Vegetables",3.49,  45, 0.06, "Frozen"),
    ]

    for item_id, name, price, amount, velocity, dept in items:
        db.session.add(Inventory(
            item_id=item_id,
            item_name=name,
            price=price,
            amount=amount,
            sales_velocity=velocity,
            is_active=True,
            department_id=departments[dept].id
        ))

    db.session.commit()

    db.session.commit()

    
def simulate_sale():
        items = Inventory.query.all()

        item = random.choices(
        items,
        weights=[i.sales_velocity for i in items],
        k=1
    )[0]

        quantity = random.randint(1, 3)

        sale = Sales(
        item_id=item.item_id,
        quantity=quantity,
        price_at_sale=item.price
    )

        db.session.add(sale)
        item.amount -= quantity
        db.session.commit()