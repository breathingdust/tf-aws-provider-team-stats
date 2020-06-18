const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');

async function main() {
  const githubToken = core.getInput('github_token');
  const org = core.getInput('org');
  const teamSlug = core.getInput('team_slug');
  const slackToken = core.getInput('slack_token');
  const slackChannel = core.getInput('slack_channel');
  const octokit = github.getOctokit(githubToken);

  const membersResponse = await octokit.teams.listMembersInOrg({
    org,
    team_slug: teamSlug,
  });

  core.info(`Found ${membersResponse.data.length} AWS team members.`);

  const searchQueries = membersResponse.data.map(async (member) => {
    const response = await octokit.search.issuesAndPullRequests({
      q: `is:pr is:open author:${member.login} draft:false org:${org}`,
    });

    return {
      member: member.login,
      count: response.data.total_count,
    };
  });

  const searchResults = await Promise.all(searchQueries);

  searchResults.sort((a, b) => {
    const nameA = a.member.toUpperCase();
    const nameB = b.member.toUpperCase();

    if (nameA < nameB) {
      return -1;
    }
    if (nameA > nameB) {
      return 1;
    }
    return 0;
  });

  core.setOutput('stats', JSON.stringify(searchResults));

  let memberLines = '';

  searchResults.forEach((member) => { memberLines += `<https://github.com/search?q=org:terraform-providers+author:${member.member}+is:pr+is:open+draft:false|${member.member}> : ${member.count}\n`; });

  const postMessageBody = {
    channel: slackChannel,
    text: 'hi',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Open Pull Requests for *Organization:* ${org} *Team:* ${teamSlug}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: memberLines,
        },
      },
    ],
  };

  axios({
    method: 'post',
    url: 'https://slack.com/api/chat.postMessage',
    headers: { Authorization: `Bearer ${slackToken}` },
    data: postMessageBody,
  })
    .then((res) => {
      core.info(`Slack Response: ${res.statusCode}`);
      core.info(res.data);
    })
    .catch((error) => {
      core.error(error);
    });
}

try {
  main();
} catch (error) {
  core.setFailed(error.message);
}
