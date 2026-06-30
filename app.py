import os
from flask import Flask
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from extensions import db, login_manager, limiter
from models import User, Inventory, Sales, Restock, SkuChange
from routes import main_routes
from sale_sim import seed_inventory, seed_demo_users


def create_app():
    app = Flask(__name__)
    
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-key")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///POS.db")

    db.init_app(app)
    login_manager.init_app(app)
    limiter.init_app(app)
    login_manager.login_view = "main_routes.login"
    CORS(app, supports_credentials=True)

    with app.app_context():
        db.create_all()
        seed_inventory()
        seed_demo_users()

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    app.register_blueprint(main_routes)

    def reset_database():
        with app.app_context():
            db.session.query(Sales).delete()
            db.session.query(Restock).delete()
            db.session.query(SkuChange).delete()
            db.session.commit()
            seed_inventory()

    if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        scheduler = BackgroundScheduler()
        scheduler.add_job(reset_database, "interval", hours=24)
        scheduler.start()

    return app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True)

