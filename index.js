const ProgressBar = require('progress');
const program = require('commander');
const fs = require('fs');
const path = require('path');
const Q = require('q');
const GitHubApi = require('github');
const throat = require('throat');
const _ = require('underscore');

const packageConfig = fs.readFileSync(path.join(__dirname, 'package.json'));

program
  .version(JSON.parse(packageConfig).version)
  .option('-u, --username [string]', 'GitHub username')
  .option('-p, --password [string]', 'GitHub password or token')
  .option('-d, --debug', 'Outputs github API debug messages')
  .parse(process.argv);

if (!program.username || !program.password) {
  console.error('All parameters are mandatory');
  process.exit();
}

const github = new GitHubApi({
  version: '3.0.0',
  debug: program.debug
});
github.authenticate({
    type: 'token',
    token: program.password
});

// const filterRepoFields = f =>
//   _.pick(f, 'name', 'full_name', 'stargazers_count', 'forks_count', 'open_issues', 'issues_url', 'pulls_url');
//
// const filterIssueFields = f =>
//   _.pick(f, 'title', 'id', 'created_at', 'url', 'pull_request', 'labels', 'state', 'comments', 'number');

const getAllPages = (apiMethod, parameters, pageNo, accumulation) => {
  accumulation = accumulation || [];
  pageNo = pageNo || 1;
  parameters = _.extend(parameters, { page: pageNo });
  return Q.nfcall(apiMethod, parameters)
    .then(result =>
      github.hasNextPage(result)
        ? getAllPages(apiMethod, parameters, pageNo + 1, result.concat(accumulation))
        : result.concat(accumulation)
    );
};

const getAllIssuesForRepo = (repo, user) =>
  getAllPages(github.issues.getForRepo, {
      'per_page': 5,
      repo,
      user
    });

Q.nfcall(github.repos.getForOrg, {org: 'd3fc'})
  .then(r => r.filter(f => f.name.startsWith('d3fc-'))
        .map(f => f.name))
  .then(repos => Q.all(repos.map(repo => getAllIssuesForRepo(repo, 'd3fc'))))
  .then(r => _.union.apply(_, r))
  .then(d => _.sortBy(d, d => new Date(d.created_at)).reverse())
  .then(d => console.log(JSON.stringify(d, null, 2)))
  .catch(console.error);
