const mediumToMarkdown = require('medium-to-markdown');
 
// Enter url here
mediumToMarkdown.convertFromUrl('https://infosecwriteups.com/how-to-spot-and-exploit-postmessage-vulnerablities-329079d307cc')
.then(function (markdown) {
  console.log(markdown); //=> Markdown content of medium post
});
