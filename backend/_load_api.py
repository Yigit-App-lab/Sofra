"""Import recipe_api without FastAPI, so audit scripts can use the real rules.

The VPS runs the API from a virtualenv; the system python has neither fastapi
nor pydantic. Rather than copy `clean_recipe_title`, `dinner_category_score` and
`NOT_A_MEAL_HEADS` into every audit script — where they would drift from the
live behaviour within a month — this stubs the web framework and imports the
module as it is.

The stubs are always used, even where fastapi is installed, so an audit gives
the same answer on the VPS, on a laptop and in CI.

    from _load_api import api
    api.dinner_category_score(category, title)

Nothing here touches a database or a network.
"""
import os
import sys
import types


def _install_stubs():
    if "fastapi" in sys.modules and getattr(sys.modules["fastapi"], "_sofra_stub", False):
        return

    class _Route:
        """Every decorator returns the function unchanged."""
        def __call__(self, *args, **kwargs):
            return lambda fn: fn

    class _App:
        def __init__(self, *args, **kwargs):
            pass

        def __getattr__(self, name):
            # get / post / put / on_event / … all decorate and return the function
            return _Route()

        def add_middleware(self, *args, **kwargs):
            pass

    fastapi = types.ModuleType("fastapi")
    fastapi._sofra_stub = True
    fastapi.FastAPI = _App
    fastapi.HTTPException = type("HTTPException", (Exception,), {})
    fastapi.Query = lambda default=None, **kwargs: default
    fastapi.Body = lambda default=None, **kwargs: default
    sys.modules["fastapi"] = fastapi

    middleware = types.ModuleType("fastapi.middleware")
    cors = types.ModuleType("fastapi.middleware.cors")
    cors.CORSMiddleware = object
    middleware.cors = cors
    sys.modules["fastapi.middleware"] = middleware
    sys.modules["fastapi.middleware.cors"] = cors

    pydantic = types.ModuleType("pydantic")

    class BaseModel:
        """Enough of a model for `class X(BaseModel)` with annotations."""
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)

    pydantic.BaseModel = BaseModel
    pydantic.Field = lambda default=None, **kwargs: default
    sys.modules["pydantic"] = pydantic

    # recipe_costs pulls this in, and no audit needs a live price.
    if "market_prices" not in sys.modules:
        market = types.ModuleType("market_prices")
        market.get_cached_price = lambda *args, **kwargs: None
        market.get_market_prices = lambda *args, **kwargs: {}
        sys.modules["market_prices"] = market


_install_stubs()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import recipe_api as api  # noqa: E402  (after the stubs, on purpose)

__all__ = ["api"]
