from flask import Flask
from flask_cors import CORS
from extensions import db, login_manager
from models import User
from routes import main_routes
from sale_sim import seed_inventory

def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = "6fg84fd63fg47g3"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///POS.db"

    db.init_app(app)
    with app.app_context():
        db.create_all()
        seed_inventory()
        
        

    login_manager.init_app(app)
    login_manager.login_view = "main_routes.login"

    CORS(app, supports_credentials=True)

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))


    app.register_blueprint(main_routes)

    return app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True)