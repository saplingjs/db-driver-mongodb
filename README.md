# MongoDB driver for Sapling

This package allows using the [MongoDB](https://www.mongodb.com/) database engine with [Sapling](https://github.com/saplingjs/sapling/).


## Installation

### Via the CLI (recommended)

This package can be installed via the [Sapling CLI](https://saplingjs.com/docs/#/cli) via the project creation questionnaire;

    sapling create

Or added to an existing project by re-running the questionnaire;

    sapling edit


### Manually

Alternatively, if you prefer to install it manually, you can install it via npm;

    npm install --save @sapling/db-driver-mongodb

Then, modify your `config.json` to select the MongoDB driver;

    {
        "db": {
            "driver": "MongoDB"
        }
    }


## Usage

Once installed, Sapling will use MongoDB running on `localhost` on port `27017` to persist all data.

You can provide alternative host and port via config if you prefer;

    {
        "db": {
            "driver": "MongoDB",
            "host": "example.com",
            "port": 27018
        }
    }


## Questions & Issues

Bug reports, feature requests and support queries can be filed as [issues on GitHub](https://github.com/saplingjs/db-driver-mongodb/issues).  Please use the templates provided and fill in all the requested details.


## Changelog

Detailed changes for each release are documented in the [release notes](https://github.com/saplingjs/db-driver-mongodb/releases).


## License

[Mozilla Public License 2.0](https://opensource.org/licenses/MPL-2.0)
