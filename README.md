# Google Analytics Realtime for Glass

View realtime analytics on Google Glass.

##Prerequisites

* Google Glass w/ access to Mirror API
* Access to Google Analytics Realtime API
* Node.js and NPM

## Installation

`npm install` or `npm install express googleapis`

## Configuration

* Create a new [Google APIs Project](https://code.google.com/apis/console)
* Enable the Google Mirror API
* Enable the Google Analytics API
* Create an OAuth 2.0 client ID for a web application
* Enter your server's hostname and port in [app.js](https://github.com/chadsmith/glass-analytics-realtime/blob/master/app.js#L5-L8)
* Enter your Mirror API credentials in [app.js](https://github.com/chadsmith/glass-analytics-realtime/blob/master/app.js#L9-L12)
* Change `UA-XXXXX-X` to your site's ID in [app.js](https://github.com/chadsmith/glass-analytics-realtime/blob/master/app.js#L168)
* Add more lines of `addCard('UA-XXXXX-X');` or visit http://hostname:port/track/UA-XXXXX-X to track additional sites

## Usage

`node app` or `forever start app.js`

* Authorize the app by visiting http://hostname:port/ on your computer
* View card in your Glass timeline
* Select start from the card menu (updates will be sent for 5 minutes)