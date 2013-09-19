var http = require('http'),
	exec = require('child_process').exec,
	asyncblock = require('asyncblock'),
	Server = require('work-order-client'),
	server_root = "http://localhost:1234/work1/collection"
	task_running = false,
	poll_time = 2500,
	work_server = new Server(server_root);

function get_avail_voices(cb) {
	// yep, I'm a jerk.
	command = "say -v ? | awk -F\"\\ \\ +\"  'BEGIN {print \"{\"} {print \"\\\"\",$1,\"\\\":\\\"\",$2,\"\\\",\"} END {print \"\\\"\\\":\\\"\\\"}\"}'"
	asyncblock(function (flow) {
		exec(command, flow.add());
		// really, i'm pretty much the worst ever.
		var result = flow.wait().split('" ').join('"').split(' "').join('"');
		var voices = JSON.parse(result);
		cb(voices);
	})
}

get_avail_voices(function (voices) {
	console.log("Available voice choices", voices)
})

function say(voice, text, cb) {
	var opts = ""
	if (voice) {
		opts = '-v "' + voice + '"';
	}
	var command = 'say ' + opts + ' "' + text + '"'
	asyncblock(function(flow) {
		exec(command, flow.add());
		var result = flow.wait();
		cb();
	});
}

function handleQueue(err, queue) {

	for(var i = 0; i < queue.state.collection.items.length; i++) {
		queue.get(i, function (err, job) {
			console.log("Job retrieved:", job);
			if (job.isType('.../say-localized-text')) {
				job.start({'about': "Speaking."}, function() {
					console.log("Saying the following:", JSON.stringify(job.state.input))

					function finish() {
						job.complete(null, function(){console.log("Job completed.")})
					}

					if (job.state.input.preferred_voice) {
						get_avail_voices(function (voices) {
							say(voices[job.state.input.preferred_voice] ? job.state.input.preferred_voice : null, job.state.input.text, finish);
						});
					} else if (job.state.input.preferred_lang) {
						get_avail_voices(function (voices) {
							var selected = null;
							for (var key in voices) {
								if (voices[key] == job.state.input.preferred_lang) {
									selected = key;
									break;
								}
							}
							say(selected, job.state.input.text, finish)
						});
					} else {
						say(null, job.state.input.text, finish);
					}
				});
				
			}
		});
	}

	task_running = false;
	console.log("Queue handled.");
}

setInterval(function() {	
		if (task_running) {
		console.log("Poll cancelled, we're running still");
		return;
	}
	console.log("Polling...");
	task_running = true;
	work_server.queue.refresh(handleQueue);
}, poll_time);

work_server.queue.refresh(handleQueue);
