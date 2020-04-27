//===================================================//
//
// Mentari Senate Election System
// Copyright (C) Select Overflow Developers 2019
//
//===================================================//

var express = require("express");
//The Express is the webserver framework used here. It runs as the backbone of our webserver.
//View https://www.npmjs.com/package/express for more information.

var app = express();
//Start Express under the variable name "app".

var http = require("http").Server(app);
//Make a new http server by grabbing the function and directly starting up a server using express.

var io = require("socket.io")(http);

//Get the jshashes module
var Hashes = require("jshashes");

//Get the body parser module - used to parse forms in the HTML body
var bodyParser = require("body-parser");

//Get the cookie parser module - used to read and write cookies from the browser
var cookieParser = require("cookie-parser");

//Get the cookies module - used to get cookies using socket.io
var cookie_reader = require("cookie");

//Get the request module - used to create http requests
var request = require("request");

//Get the file system module - used to accesses files
var fs = require("fs");

//Get the jshashes module
var jshashes = require("jshashes");

//Get the cryptr module - to encrypt and decrypt IDs that need to be stored on the frontend
var Cryptr = require("cryptr");
var cryptr = new Cryptr("7852b85513.458099871212568d41d8cd98f00b204e9800998ecf8427e");

//Generate the hash functions
var md5 = new jshashes.MD5;
var sha256 = new jshashes.SHA256;
var sha1 = new jshashes.SHA1;

//Integrate the bodyParser module into the app
app.use(bodyParser.urlencoded({
	"extended": true
}));

//Use the said modules
app.use(bodyParser.json());
app.use(cookieParser());

//Temporary databases ==
/* These variables will be written into the file every 1 minute respectively */
var voter_registrar = [];
var ballots = [];
var voting_timestamp = [];

//Set the temporary databases to the actual database values
//The values of these variables will only be set when the server starts up
voter_registrar = JSON.parse(fs.readFileSync("./json/voter_registrar.json"));
ballots = JSON.parse(fs.readFileSync("./json/ballots.json"));
voting_timestamp = JSON.parse(fs.readFileSync("./json/voter_timestamp.json"));

setInterval(function () {

	//Every minute, update the permanent databases with the temporary databases
	//Stringify the arrays so that they can be properly inserted into the files.
	//This will prevent data from being written over each other.

	var time_now = new Date().getTime();

	//Update the voter registrar
	fs.writeFileSync("./json/voter_registrar.json", JSON.stringify(voter_registrar, null, 4));

	//Update the ballots registrar
	fs.writeFileSync("./json/ballots.json", JSON.stringify(ballots, null, 4));

	//Update the voting timestamp registrar
	fs.writeFileSync("./json/voter_timestamp.json", JSON.stringify(voting_timestamp, null, 4));

	console.log("\x1b[46m" + time_now +": Databases saved.\x1b[0m");

}, 60000);

//Create new hash instances
var md5 = new Hashes.MD5;
var sha256 = new Hashes.SHA256;
var sha1 = new Hashes.SHA1;
var sha512 = new Hashes.SHA512;

//This will be the port the server will run on. If we're running the server locally,
var port = process.env.PORT || 27016;

console.log("Starting server up on port " + port);

http.listen(port, function () {
	//Start the server on port 80. This section will write to the console about information regarding
	//the start time of the server (to keep track of when this log was made).

	console.log("The server is now running on port " + port + "\n");
	//Once the server has started, notify the console of the new process.

});

//Handle connections to the main path
app.get("/", function (request, response) {

	console.log("Client connected to main path /.");
	response.sendFile(__dirname + "/public/index.html");
	//By default, node does not allow the client to access any files. Because of that, we
	//have to define the file that is allowed to be interacted with by the client. The
	//'public' folder is the folder for the frontend, which is the file sent to the client.

	var cookies = request.cookies;
	var cookies_keys = Object.keys(cookies);

	if (cookies_keys.includes("_approval") && cookies_keys.includes("_verify") && cookies_keys.includes("_ident")){

		//If the cookie requirements have been met, we'll send them along to the ballot page
		console.log("Cookie requirements satisfied ("+cookies_keys.length+")");
		console.log("Checking if the voting token is active.");

		_ident = cookies._ident;
		_ident = unescape(_ident);

		//Grab the index by parsing the decrypted result
		var account_index = parseInt(cryptr.decrypt(_ident));

		console.log("Account index:", account_index);

		//Grab the number of accounts that exist in the voter registrar
		var voter_count = voter_registrar.length;

		if (account_index !== NaN && _ident !== null && account_index > voter_count && 0 > account_index){

			//If the _ident cookie looks good here, we can check if the client has voted or not:
			var voter_profile = voter_registrar[account_index];

			if (voter_profile.active_token){

				//If the token is still active, we can redirect them to the voting page:
				response.redirect("/vote");

			}

		}

	}

});

app.get("/vote", function(request, response){

	//Handle connections to the /vote path. Only users with valid cookies (_approval and _verify)
	//can connect

	console.log("Client requested path \x1b[33m/vote\x1b[0m. Checking for valid credentials.");

	var cookies = request.cookies;
	var cookies_keys = Object.keys(cookies);

	if (!cookies_keys.includes("_approval") || !cookies_keys.includes("_verify") || !cookies_keys.includes("_ident")){

		//if any of the two variables are missing, we will redirect the user back to the
		//main menu. There, they can insert their tokens and acquire the necessary cookies.
		console.log("Redirecting client to main path. Not all cookie requirements were met.");
		response.redirect("/");

	} else {

		//If both the cookies are here, we will extract their values and store them in individual
		//variables:
		var _verifyActual = cookies._verify;
		var _approvalActual = cookies._approval;
		var _ident = cookies._ident;

		var ip = request.headers["x-forwarded-for"] || request.connection.remoteAddress;
		var browser = request.headers["user-agent"];

		var _verifySalt1 = md5.hex("REDACTED" + ip);
		var _verifySalt2 = sha1.hex(_verifySalt1 + ip + browser);

		//The actual _verify variable itself
		var _verifyCompare = sha256.hex(_verifySalt1 + _verifySalt2 + "REDACTED");

		//The _approval variable to be generated later
		var _approvalCompare;

		//We'll need to decode the _ident variable so that we can get the account index number
		var account_index = parseInt(cryptr.decrypt(_ident));

		if (account_index == NaN || account_index < -1 || account_index > voter_registrar.length){

			//If the account index is NaN, we cant locate the account. Redirect to the main path:
			console.log(account_index);
			response.redirect("/");
			console.log("Moved client to main path (/). Account index is NaN.");

	 	} else {

			_approvalCompare = sha256.hex(voter_registrar[account_index].voter_token);

			console.log("Generated \x1b[35m_verify\x1b[0m: og", _verifyCompare);
			console.log("Generated \x1b[35m_approval\x1b[0m: og", _approvalCompare);
			console.log("\x1b[35m_ident\x1b[0m cookie is " + _ident);

			if (_approvalActual !== _approvalCompare || _verifyActual !== _verifyCompare){
				console.log("Discrepancy detected. Cookies do not line up.");
			} else {

				//If all the cookies line up, check if the token is active;
				var active_token = voter_registrar[account_index].valid_token

				if (!active_token){

					console.log("Token is inactive, deleting cookies and redirecting to main path");
					//If the token isnt active, delete the cookies and redirect to the main path:
					response.setHeader("set-cookie", "_ident=; max-age=0;");

					response.redirect("/");

				} else {

					//If the token is still active, we can send the page to the frontend:
					response.sendFile(__dirname + "/public/ballot/index.html");

				}

			}

		}

	}

});

app.use(express.static(__dirname + "/public/"));

io.on("connection", function (socket) {


	var time_now = new Date().getTime();
	console.log("New connection established with " + socket.id + " at " + time_now);

	socket.on("disconnect", function () {
		console.log("Connection with " + socket.id + " has been terminated");
	});


	//Get the cookies from the browser
	var cookie_raw = socket.handshake.headers.cookie;

	//Empty cookie variable. The cookies will be stored here in JSON form
	//after they raw cookie data has been verified and ensured that it is not
	//undefined.
	var cookie;

	//Because sometimes cookie_raw can be undefined, we need to check it.
	//When it is undefined, we will give the refresh signal to the frontend
	//(this will usually solve the issue).
	if (cookie_raw == null){
		console.log("Null cookie data received. Giving refresh signal to browser");
		socket.emit("refresh");
		socket.disconnect();
		return;
	} else {

		//If the raw cookie data is good, we can go ahead and define the cookies
		//variable and continue with the code.
		cookie = cookie_reader.parse(cookie_raw);
		console.log("There are " + Object.keys(cookie).length + " cookies available for client " + socket.id);

	}

	if (!socket.request.headers["user-agent"].includes("Mozilla")) {

		//This statement just checks whether or not the client is connected through a browser.
		//If they are not connected through a browser, we will immediately disconnect them,
		//as they could run potentially harmfull scripts towards our server, which could
		//cause performance and security issues.

		console.log("Forcefully disconnected " + socket.id + " from the server (no browser detected)");
		socket.disconnect();

	}

	var authenticate = {

		//Authentication functions for the three primary cookie
		//variables.

		_verify: function(){

			//Authentication for the _verify function. Make sure that the given data matches
			//the given server cookie. This is to prevent cookie stealing as the user needs
			//data given from the server.

			comparison_variable = unescape(cookie._verify);

			var ip = socket.request.headers["x-forwarded-for"] || socket.request.connection.remoteAddress;
			var browser = socket.request.headers["user-agent"];

			var _verifySalt1 = md5.hex("REDACTED" + ip);
			var _verifySalt2 = sha1.hex(_verifySalt1 + ip + browser);

			//The actual _verify variable itself
			var _verifyCompare = sha256.hex(_verifySalt1 + _verifySalt2 + "REDACTED");

			if (comparison_variable !== _verifyCompare){
				return 404;
			} else {
				return 200;
			}

		},

		_ident: function(){

			//Find the user account number from the _ident cookie variable.

			_ident = cookie._ident;
			_ident = unescape(_ident);

			//Grab the index by parsing the decrypted result
			var account_index = parseInt(cryptr.decrypt(_ident));

			//Grab the number of accounts that exist in the voter registrar
			var voter_count = voter_registrar.length;

			if (account_index == NaN || _ident == null){
				return 404;
			} else {

				if (account_index > voter_count || 0 > account_index){
					return 404;
				} else {

					//If all the numbers and conditions add up, the number here should
					//be legit:
					return {
						status: 200,
						account_index: account_index
					}

				}

			}

		},

		_approval: function(account_index){

			//Authenticate the approval cookie
			_approvalCompare = sha256.hex(voter_registrar[account_index].voter_token);
			approval_cookie = cookie._approval;

			if (account_index == NaN) return 404;

			if (approval_cookie !== _approvalCompare){
				return 401;
			} else {
				return 200;
			}

		}

	}

	//We'll check if the 3 primary cookies are set on the computer. If they are, we can
	//send the voter data to the frontend:
	var cookie_keys = Object.keys(cookie);

	if (cookie_keys.includes("_approval") && cookie_keys.includes("_verify") && cookie_keys.includes("_ident")){

		console.log("Socket.IO has detected the 3 primary cookies. Authenticating them");

		var ident_authentication = authenticate._ident();
		var verify_authentication = authenticate._verify();
		var approval_authentication = authenticate._approval(ident_authentication.account_index);

		if (verify_authentication == 200 && ident_authentication !== 404 && approval_authentication == 200){

			//The voter object
			var voter = voter_registrar[ident_authentication.account_index];

			//If all of the given data adds up, then we can send the election data to the frontend.
			socket.emit("voter_email", voter.voter_email);
			socket.emit("voter_token", voter.voter_token);
			socket.emit("voter_id", voter.voter_id);
			socket.emit("voter_grade", voter.voter_grade);

			//After the basic data has been generated, we will start sending the candidate names to the
			//frontend:

			var voter_grade;

			(voter.voter_grade < 9) ? voter_grade = "0" + parseInt(voter.voter_grade) : voter_grade = voter.voter_grade;

			var candidates = ballots[voter_grade]; //Array

			for (var i = 0; i < candidates.length; i++){
				socket.emit("candidate_name", candidates[i].candidate_name, i+1, candidates[i].candidate_id, candidates.length);
			}

			console.log("All OK for current client connected " + socket.id + ". Sent candidate details to frontend ballot.");

		}

	}

	socket.on("vote", function(options){

		console.log("Voting function called");

		var ident_authentication = authenticate._ident();
		var verify_authentication = authenticate._verify();
		var approval_authentication = authenticate._approval(ident_authentication.account_index);

		if (!cookie_keys.includes("_approval") || !cookie_keys.includes("_verify") || !cookie_keys.includes("_ident")){
			console.log("Client failed authentication (requested vote). Disconnected client");
			socket.disconnect();
			return;
		}

		if (verify_authentication == 200 && ident_authentication !== 404 && approval_authentication == 200){

			var client_vote = vote(voter_registrar[ident_authentication.account_index].voter_token, options);

			console.log("Voting function called. Calling the voting function; all credentials set and OK");
			console.log("\x1b[35mResponse from voting function\x1b[0m:", client_vote);

			socket.emit("voting_response", client_vote);;
			console.log("\x1b[35mSent voting response to client\x1b[0m:", client_vote);

			if (client_vote == "Success! Your vote has been cast. Thank you for voting."){

				//Check if the vote was successfully cast. If it was casted succesfully, we will send
				//the signal to the frontend to reload the page and follow the voting success protocol.
				socket.emit("voting_success");


			}

		}

	});

	//Token verification
	socket.on("verify_token", function(token){

	//We've received a request from the frontend. First we'll check if the
	//'voter_token' field is open in the request just for safety.

	console.log("Received token from frontend for verification: " + token);

	if (token !== "" || token !== null) {

		console.log("Received and verifying voter token " + token);

		//Use .findIndex() to find if the token is legit
		var token_index = voter_registrar.findIndex(data => data.voter_token == token);

		if (token_index == -1) {
			console.log(token + " is invalid.");
			socket.emit("error_message", "The token you inputted is invalid.");
		} else {

			//If the token is valid, we need to check if it has already been used or not:
			var isUsed = voter_registrar[token_index].valid_token;

			if (!isUsed) {
				console.log("Token " + token + " has already been used. Rejecting the request and sending a response")
				socket.emit("error_message", "That token has already been used.");
				return;
			}

			//If we find the token, we will send the user to the voting page
			console.log(token + ": Token is valid. Found index at \x1b[35mvoter_registrar\x1b[0m at position \x1b[33m" + token_index + "\x1b[0m");

			//We will first set a cookie that will enable them to go to the next page.
			//We will set two unique cookies for additional security.

			//The first cookie will be called _verify, while the other cookie will be called _approval. _approval
			//will be a hash that allows the user to continue, but they must have _verify on their machine to pass.
			//_verify can only be acquired from the server.

			//has _approval but no _verify or invalid _verify = terminate connection
			//has _verify but no _approval = terminate connection

			console.log("Generating \x1b[35m_verify\x1b[0m token for " + token);

			//The _verify variable will include strings that can only be found on the server, and will be tied to the
			//user's machine information.
			var ip = socket.request.headers["x-forwarded-for"] || socket.request.connection.remoteAddress;
			var browser = socket.request.headers["user-agent"];

			console.log("User address is \x1b[33m" + ip + "\x1b[0m");
			console.log(socket.request.connection.remoteAddress);

			var _verifySalt1 = md5.hex("TESTING 123 ELECTION zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz " + ip);
			var _verifySalt2 = sha1.hex(_verifySalt1 + ip + browser);

			//The actual _verify variable itself
			var _verify = sha256.hex(_verifySalt1 + _verifySalt2 + "13376931t3h4xn0d3");

			console.log("Generating \x1b[35m_approval\x1b[0m token for " + token);
			var _approvalToken = sha256.hex(voter_registrar[token_index].voter_token);

			socket.emit("success_message", "Token successfully validated and approved by the server");

			console.log("Generated \x1b[35m_verify\x1b[0m:", _verify);
			console.log("Generated \x1b[35m_approval\x1b[0m:", _approvalToken);

			var voter_ident = token_index;
			var voter_ident_cookie = cryptr.encrypt(voter_ident);
			console.log("Voter identification hash is " + voter_ident_cookie + ".")

			//Set the cookies
			socket.emit("set_cookie", "_verify", _verify);
			socket.emit("set_cookie", "_approval", _approvalToken);
			socket.emit("set_cookie", "_ident", voter_ident_cookie);

			//Once the cookies are set, we can forward the client to /vote. Express will handle
			//the cookie validation upon the next reconnection.

			socket.emit("redirect", "/vote");

		}

	} else {
		console.log("Invalid token provided by " + socket.id);
		socket.emit("error_message", "Incorrect or invalid token provided.");
	}

	});


});

//console.log(vote("4b359b45c3545cec89589b05e8f888b6", ["090ecf12"]));

function vote(token, options){

	//This will be the voting function. It will be invoked when a vote needs to be recorded.

	//The first part of this process will be to check whether or not the given token is legitimate
	//or not

	//token is a string
	//options is an array

	//We'll use the temporary databases as a point of reference here

	token = unescape(token);

	var index = voter_registrar.findIndex(data => data.voter_token == token);

	//If a value of -1 is found from the index search, the token does not exist
	if (index == -1) {
		return "That token does not exist";
	}

	if (!(options instanceof Array)){
		console.log("Invalid format given for options");
		return "The server encountered an error with the data your browser sent. Please reload the page and try again.";
	}

	console.log("Voter " + voter_registrar[index].voter_id + " at grade level " + voter_registrar[index].voter_grade);

	//Next, check if the token is still active or not
	if (!voter_registrar[index].valid_token) {
		return "Your token has already been used";
	}

	//Check if the options are empty:
	if (options.length < 1) {
		return "You can not vote for no one.";
	} else if (options.length > 2) {
		return "Too many candidates inputed.";
	}

	//If the parameters for the variable options are alright at this point, we need to escape them

	//Check if the candidates IDs this user wants to vote are the same
	if (options[0] == options[1]) {
		return "Candidates can not be the same";
	}

	//Check if the given options are legitimate or not:
	//The candidate IDs always start with the grade level first.

	//Get the first two characters of the option ID
	//Since there could be 1 or 2 votes casted, we will store it in an array
	var candidateGrades = [];
	var candidateIndexNumber = [];

	//Iterate through the options array and complete the necessary tasks
	for (var i = 0; i < options.length; i++) {

		var candidateGrade = options[i].slice(0, 2);

		//Push the candidate grade level into the array
		candidateGrades.push(options[i].slice(0, 2));

		console.log("Going through for " + options[i] + " at grade level " + candidateGrade);

		//Check the database to see if the candidate number exists
		var candidate_docs = ballots[candidateGrades[i]];
		var found = false;

		for (var a = 0; a < candidate_docs.length; a++) {

			if (candidate_docs[a].candidate_id == options[i]) {

				//We found the candidate, set found to true and exit this branch of the for loop
				//Push the index number we found into an array for reference later
				candidateIndexNumber.push(i);

				found = true;
				break;

			}

		}

		//If found is still false, we will exit the code citing that the candidate number could
		//not be found
		if (!found) return "Candidate number(s) not found";

		//Check if the grade level aligns with the grade level of the voter:
		if (parseInt(candidateGrades[i]) !== voter_registrar[index].voter_grade) {
			return "Grade level does not align with candidate " + options[i];
		}

		//Check if any of the grades are NaN or are <6 or 12>
		if (candidateGrades[i] == NaN || candidateGrades[i] < 6 || candidateGrades[i] > 12) {
			return "Candidate voting number(s) not found or is forbidden";
		}

		//If all of the checks above are met, register the user's vote

		//In the voter_registrar first:
		voter_registrar[index].valid_token = false;
		voter_registrar[index].casted_votes.push(options[i]);

		//In the voting timestamp field:
		var time_now = new Date().getTime();

		voting_timestamp.push({
			"voter_id": voter_registrar[index].voter_id,
			"candidate_number": options[i],
			"time_voted": time_now
		});

		//In the ballots field:
		ballots[candidateGrades[i]][candidateIndexNumber[i]].voters.push(voter_registrar[index].voter_id);

	}

	//In the voters timestamp:
	var time_now = new Date().getTime();

	//console.log(voter_registrar);
	//console.log(voting_timestamp);

	return "Success! Your vote has been cast. Thank you for voting.";

}
