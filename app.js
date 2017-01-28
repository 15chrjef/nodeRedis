var app = require('express')()
var redis = require('redis');
var axios = require('axios')
var responseTime = require('response-time')

var client = redis.createClient();


client.on('error', function(err) {
	console.log('Error' + err);
})

app.set('port', ( process.env.PORT || 5000 ));

app.use(responseTime());

const getUserRepositories = (user) => {
	var githubEndpoint = 'https://api.github.com/users/' + user + '/repos' + '?per_page=100';
	return axios.get(githubEndpoint);
}

const computeTotalStars = (repositories) => {
	return repositories.data.reduce(function(prev, curr) {
		return prev + curr.stargazers_count
	}, 0)
}

app.get('/api/:username', function(req,res) {
	var username = req.params.username;
	client.get(username, function(error, result) {
		if(result) {
			res.send({ "totalStars": result, "source": "redis cache"})
		} else {
			getUserRepositories(username)
			.then(computeTotalStars)
			.then(function(totalStars) {
				client.setex(username, 60, totalStars);
				res.send({ "totalStars": totalStars, "source": "GitHub API" });
			})
			.catch(function(response) {
				if(response.status === 404) {
					res.send(`The GitHub username could not be found. Try "coligo-io" as an example!`);
				} else {
					res.send(response)
				}
			});
		}
	})
});

app.listen(app.get('port'), function() {
	console.log('server listening on port', app.get('port'));
})

