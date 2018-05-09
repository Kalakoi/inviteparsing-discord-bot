const https = require("https"),
	fs = require("fs"),
	Discord = require("discord.js"),
	bot = new Discord.Client({autoReconnect: true}),
	channelPath = __dirname + "/channels",
	settingsPath = __dirname + "/settings";
var servers = [];
var settings;

function leadingZero(d){
	if(d < 10) {
		return "0" + d;
	} else {
		return d;
	}
}

function print(msg, err) {
	var date = new Date();
	var h = leadingZero(date.getHours());
	var m = leadingZero(date.getMinutes());
	var s = leadingZero(date.getSeconds());
	
	var timestamp = "[" + h + ":" + m + ":" + s + "]";
	console.log(timestamp, msg);
	
	newLog = {time: timestamp, message: msg};
	logs.push(newLog);
	
	if(err) {
		console.log(err);
		errLog = {time: timestamp, message: err};
		logs.push(errLog);
	}
}

function indexOfObjectByName(array, value) {
	for(let i = 0; i < array.length; i++) {
		if(array[i].name.toLowerCase().trim() === value.toLowerCase().trim()) {
			return i;
		}
	}
	return -1;
}

function exitHandler(opt, err) {
	if(err) {
		print(err);
	}
	if(opt.save) {
		print("Saving channels to " + channelPath + " before exiting");
		fs.writeFileSync(channelPath, JSON.stringify(servers, null, 4));
		print("Done");
	}
	if(opt.exit) {
		process.exit();
	}
}

process.on("exit", exitHandler.bind(null, {save:true}));
process.on("SIGINT", exitHandler.bind(null, {exit:true}));
process.on("SIGTERM", exitHandler.bind(null, {exit:true}));
process.on("uncaughtException", exitHandler.bind(null, {exit:true}));

function tick() {
	for (let i = 0; i < servers.length; i++) {
		var server = servers[i];
		var guildArray = bot.guilds.array();
		for (let j = 0; j < guildArray.length; j++) {
			if (guildArray[j].name == server.name) {
				var newInviteLinks = [];
				guildArray[j].fetchInvites().then((invites) => {
					newInviteLinks.push({
						name: invites[i].code,
						uses: invites[i].uses
					});
				});
				server.inviteLinks = newInviteLinks;
			}
		}
	}
}

bot.on("guildMemberAdd", (member) => {
	let index = indexOfObjectByName(servers, member.guild.name);
	let newInviteLinks = [];
	if (index == -1) {
		print("Error occurred, member joined guild without settings");
		return;
	}
	member.guild.fetchInvites().then((invites) => {
		for (let i = 0; i < invites.size; i++) {
			newInviteLinks.push({
				name: invites[i].code,
				uses: invites[i].uses
			});
		}
	});
	let server = servers[index];
	let inviteLinks = server.inviteLinks;
	
	var potentialUsedInvites = [];
	for (let i = 0; i < newInviteLinks.length; i++) {
		let inviteIndex = indexOfObjectByName(inviteLinks, newInviteLinks[i].name);
		if (index == -1) {
			potentialUsedInvites.push(newInviteLinks[i].name);
		} else if (newInviteLinks[i].uses > inviteLinks[inviteIndex].uses) {
			potentialUsedInvites.push(newInviteLinks[i].name);
		} else {
			continue;
		}
	}
	
	var msg = "Member " + member.user.tag + " joined using invite:";
	for (let i = 0; i < potentialUsedInvites.length; i++) {
		msg += "\n" + potentialUsedInvites[i];
	}
	for (let i = 0; i < server.discordChannels.length; i++) {
		member.guild.channels.find("name", server.discordChannels[i]).send(msg);
	}
	
	inviteLinks = newInviteLinks;
});

bot.on("guildCreate", (guild) => {
	let index = indexOfObjectByName(servers, guild.name);
	if (index == -1) {
		guild.fetchInvites().then((invites) => {
			for (let i = 0; i < invites.size; i++) {
				inviteLinks.push({
					name: invites[i].code,
					uses: invites[i].uses
				});
			}
		});
		
		servers.push({
			name: guild.name,
			lastPrefix: "!", prefix: "/",
			role: "botadmin", discordChannels: [],
			inviteLinks: inviteLinks
		});
		index = servers.length - 1;
	}
});

bot.on("guildDelete", (guild) => {
	let index = indexOfObjectByName(servers, guild.name);
	if (index == -1) {
		
	} else {
		servers.splice(index, 1);
	}
});

bot.on("message", (message) => {
	var server, inviteLinks = [];
	if(!message.guild) {
		return;
	} else if (message.author.bot) {
		return;
	} else {
		let index = indexOfObjectByName(servers, message.guild.name);
		if(index == -1) {
			message.guild.fetchInvites().then((invites) => {
				for (let i = 0; i < invites.size; i++) {
					inviteLinks.push({
						name: invites[i].code,
						uses: invites[i].uses
					});
				}
			});
			
			servers.push({
				name: message.guild.name,
				lastPrefix: "!", prefix: "/",
				role: "botadmin", discordChannels: [],
				inviteLinks: inviteLinks
			});
			index = servers.length - 1;
		}

		server = servers[index];
		inviteLinks = server.inviteLinks;
	}
	
	if(message.content[0] == server.prefix) {
		let index;
		
		if (message.content.substring(1,6) == "about") {
			var embed = new Discord.RichEmbed()
				.setColor('GOLD')
				.setTitle(bot.user.tag)
				.setAuthor("Invite Parsing Discord Bot")
				.setURL("https://discordapp.com/oauth2/authorize?client_id=" + bot.user.id + "&scope=bot")
				.setDescription("A custom made bot to determine invite links used to join a server.")
				.setThumbnail(bot.user.displayAvatarURL)
				.setFooter("Created with love by Kalakoi.")
				.addField("Servers", bot.guilds.array().length, false);
			message.channel.send(embed);
		} else if (message.content.substring(1,10) == "configure") {
            let msg = "";
			if (message.member.hasPermission("MANAGE_GUILD",false,true,true)) {
                if(message.content.substring(11, 15) == "list"){
                    msg += "```\n" +
                           "prefix    " + server.prefix + "\n";

                    msg += "channels  " + server.discordChannels[0];
                    if(server.discordChannels.length > 1){
                        msg += ",";
                    }
                    msg += "\n";

                    for(let i = 1; i < server.discordChannels.length; i++){
                        msg += "          " + server.discordChannels[i];
                        if(i != server.discordChannels.length -1){
                            msg += ",";
                        }
                        msg += "\n";
                    }
					
                    msg += "```";

                } else if (message.content.substring(11, 17) == "prefix") {
                    let newPrefix = message.content.substring(18, 19);
                    if (newPrefix.replace(/\s/g, '').length === 0) {
                        msg += "Please specify an argument";
                    } else if (newPrefix == server.prefix) {
                        msg += "Prefix already is " + server.prefix;
                    } else {
                        server.lastPrefix = server.prefix;
                        server.prefix = newPrefix;
                        msg += "Changed prefix to " + server.prefix;
                    }

                } else if(message.content.substring(11, 18) == "channel") {
                    if(message.content.substring(19, 22) == "add") {
                        let channel = message.content.substring(23);
                        if(channel.replace(/\s/g, '').length === 0) {
                            msg += "Please specify an argument";
                        } else if (message.guild.channels.exists("name", channel)) {
                            server.discordChannels.push(channel);
                            msg += "Added " + channel + " to list of channels to post in.";
                        } else {
                            msg += channel + " does not exist on this server.";
                        }
                    } else if (message.content.substring(19, 25) == "remove") {
                        for(let i = server.discordChannels.length; i >= 0; i--) {
                            let channel = message.content.substring(26);
                            if (channel.replace(/\s/g, '').length === 0) {
                                msg = "Please specify an argument";
                                break;
                            } else if (server.discordChannels[i] == channel) {
                                server.discordChannels.splice(i, 1);
                                msg = "Removed " + channel + " from list of channels to post in.";
                                break;
                            } else {
                                msg = channel + " does not exist in list.";
                            }
                        }
                    } else {
                        msg = "Please specify an argument for channel";
                    }
                } 
			}
		}
	}
});

bot.on("ready", () => {
	print("Updating Invite Link Lists");
	var guildArray = bot.guilds.array();
	for(let i = 0; i < guildArray.length; i++) {
		let index = indexOfObjectByName(servers, guildArray[i].name);
		let inviteLinks = [];
		guildArray[i].fetchInvites().then((invites) => {
			for (let i = 0; i < invites.size; i++) {
				inviteLinks.push({
					name: invites[i].code,
					uses: invites[i].uses
				});
			}
		});
		if(index == -1) {
			servers.push({
				name: guildArray[i].name,
				lastPrefix: "!", prefix: "/",
				role: "botadmin", discordChannels: [],
				inviteLinks: []
			});
			index = servers.length - 1;
		}
		let server = servers[index];
		server.inviteLinks = inviteLinks;
	}
	print("Updated Successfully");
	print("");
});

print("Reading file " + settingsPath + ".");
var settingsFile = fs.readFileSync(settingsPath, {encoding:"utf-8"});
settings = JSON.parse(settingsFile);
print("File read successfully.");

bot.login(settings.token).then((token) => {
	if(token) {
		print("Logged in as " + bot.user.tag);
		print("");
		
		print("Reading file " + channelPath + ".");
		var file = fs.readFileSync(channelPath, {encoding:"utf-8"});
		servers = JSON.parse(file);
		print("File read successfully.");
		print("");
		
		var guildArray = bot.guilds.array();
		print("Member of " + guildArray.length + " servers");
		for(let i = 0; i < guildArray.length; i++) {
			print("Serving " + guildArray[i].name + " with " + guildArray[i].memberCount + " users");
		}
		print("");
		
		tick();
		setInterval(tick, settings.interval);
	} else {
		print("An error occurred while logging in:", err);
		process.exit(1);
	}
});
