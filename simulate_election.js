
var fs = require("fs");
var voter_registrar = JSON.parse(fs.readFileSync("./json/voter_registrar.json"));
var ballots = JSON.parse(fs.readFileSync("./json/ballots.json"));

//Iterate over all of the voter registers and make everyone vote
for (var i = 0; i < voter_registrar.length; i++){

    if (voter_registrar[i].valid_token){

        //If the current voter still has an active voting token, we will use it
        voter_registrar[i].valid_token = false;

        var voter_grade = voter_registrar[i].voter_grade;

        if (voter_grade < 10) voter_grade = ("0" + voter_grade).toString();

        console.log("candidate_length = " + candidate_length);
        console.log('voter_grade = "' + voter_grade +'"');
        console.log("voter_id = " + voter_registrar[i].voter_id);
        console.log("i = " + i + "\n");

        var candidates = ballots[voter_grade];
        var candidate_length = candidates.length;

        var vote1 = Math.floor(Math.random()*candidate_length);
        var vote2 = Math.floor(Math.random()*candidate_length);

        console.log("Voting for candidate #" + vote1);
        console.log("Voting for candidate #" + vote2);

        ballots[voter_grade][vote1].voters.push(voter_registrar[i].voter_id);
        ballots[voter_grade][vote2].voters.push(voter_registrar[i].voter_id);

        console.log("Voting on behalf of " + voter_registrar[i].voter_id +" at grade "+ voter_grade + " with a candidates of " + candidate_length);
    
    }

}

var time_now = new Date().getTime();

//Write the results into a file
fs.writeFileSync("./json/null_ballot_"+time_now+".json", JSON.stringify(ballots, null, 4));

console.log("Wrote to file ./json/null_ballot_"+time_now+".json");