const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios')

async function main(){
    const githubToken = core.getInput('github_token');
    const org = core.getInput('org');
    const teamSlug = core.getInput('team_slug');
    const slackToken = core.getInput('slack_token');
    const slackChannel = core.getInput('slack_channel');
    const octokit = github.getOctokit(token);   

    const membersResponse = await octokit.teams.listMembersInOrg({
        org: org,
        team_slug: teamSlug
    });

    core.info(`Found ${membersResponse.data.length} AWS team members.`);
    
    const searchQueries = membersResponse.data.map(async member => {
            const response = await octokit.search.issuesAndPullRequests({
                q : `is:pr is:open author:${member.login} draft:false org:${org}`
            });

            const result = {
                member: member.login,
                count: response.data.total_count,
            }
            return result;
        }
    );

    const searchResults = await Promise.all(searchQueries);

    searchResults.sort(function(a, b) {
        var nameA = a.member.toUpperCase();
        var nameB = b.member.toUpperCase();
        return (nameA < nameB) ? -1 : (nameA > nameB) ? 1 : 0;
    });  

    core.setOutput("stats", JSON.stringify(searchResults));

    let memberLines = ""

    searchResults.map(member => memberLines+= `<https://github.com/search?q=org:terraform-providers+author:${member.member}+is:pr+is:open+draft:false|${member.member}> : ${member.count}\n`);

    let postMessageBody = {
        channel: slackChannel,
        text: "hi",
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Open Pull Requests for *Organization:* ${org} *Team:* ${teamSlug}`
                }
            },
            {
                type: "divider"
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: memberLines
                }
            }
        ]
    };

    axios({
        method: 'post',
        url: 'https://slack.com/api/chat.postMessage',
        headers: {'Authorization': `Bearer ${slackToken}`},
        data: postMessageBody
        })
      .then((res) => {
        core.info(`Slack Response: ${res.statusCode}`)
        console.log(res)
        core.info(res.data);
      })
      .catch((error) => {
        core.error(error)
      })
}

try{
    main();
} catch (error) {
    core.setFailed(error.message);
}