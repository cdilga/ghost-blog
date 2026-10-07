---
title: "What is an API?"
description: "Investigating something all of us use on a daily basis, but something that is abstract and very much intangible most of the time, using Trello a work space management tool."
date: 2020-04-27T11:55:50.000Z
tags: ["Technical"]
image: "/img/ghost/what-is-an-api/API-lab-background-1.webp"
legacy: true
source: "https://chris.dilger.me/what-is-an-api/"
---

Investigating something all of us use on a daily basis, but something that is abstract and very much intangible most of the time, using Trello a work space management tool.

Feel free to create an account at [http://trello.com/](http://trello.com/), create a few cards and then move them around to get a feel for how the app works before reading the rest of the post. If you don't feel like following along, you'll still be able to understand what is going on.

## API...

When learning about how programs talk to each other, the term API or Application Program Interface will be thrown around. Even the simple English Wikipedia definition is quite wordy and difficult to understand.

Modern webapps will use API's to allow programs to send data, receive data and make things happen in another application. API's are designed to be used by programs, though will have some documentation that is readable by humans so that we can understand how to write new programs that can use an API.

<figure class="ghost-figure"><img src="/img/ghost/what-is-an-api/image.webp" alt="" loading="lazy"><figcaption>A trello card. In fact, the very card that requires me to make this post!</figcaption></figure>

Let's start with an example. Trello is a common tool for showing how work is being done, and is being shared between people. One of the key objects in Trello, is the Card.

Cards can have:

-   Name
-   Description
-   Members (people)
-   Checklists
-   Due Dates

Typically in Trello we would do things like

1.  Create a Card
2.  Move a card
3.  Add myself to a card

Sometimes the acronym CRUD - Create Read Update Delete is used to describe the possible actions on an API in a basic API.

All of these actions have an associated API endpoint to achieve this change.  
An API endpoint is a URL where we're able to send requests to, which then will either send data to the server and cause a change (POST) or return data to us (GET).

At [https://developer.atlassian.com/cloud/trello/rest](https://developer.atlassian.com/cloud/trello/rest) we have access to all of the API endpoints that allow us to do the things to the cards, and input data.

## GET - ing cards

If we want to look at some of the cards that already exist at the "Get a card" endpoint which we can GET from /1/cards/{id}

[https://developer.atlassian.com/cloud/trello/rest/#api-cards-id-](https://developer.atlassian.com/cloud/trello/rest/#api-cards-id-get)

A url is composed of the following components:

`URI = scheme://path/to/endpoint[?query=value&another=other][#fragment]`

The `GET /1/cards/{id}` component of the URL in means that the `{id}` will be replaced by some id for our cards. The API documentation also mentions several other

Let's find what our browser actually did when we retrieved a list of all the cards, as well as a number of other query parameters to pass these along to the server. For example, the `checklists` query parameter can be set to `all` or `none` like so

```
https://trello.com/1/card/5e9ed7067dbdd871af184f98?checklists=all
```

So where can we find this ID? Your browser can show us the magic behind the scenes. When creating instructions, I used Chrome but any browser should work.

Open up trello and open a board with some cards in it. Click on one of the cards to open up the large editor window.  
Right click click to "Inspect Element" and then switch to the network tab. Check the box for "Preserve Log" to keep the logs after page refreshes.

<figure class="ghost-figure"><img src="/img/ghost/what-is-an-api/image-1.webp" alt="" loading="lazy"><figcaption>The window after a page refresh in Chrome</figcaption></figure>

In the filter box, as above enter `/card` and chrome will find  all of the calls involving the card endpoints. We can see that it sent off a request to find our card. In the preview tab we can see the JSON response the API sent back after we sent the above URL to the server.

In the JSON response underneath actions>0>data>card we should see the Card title as well as several other bits of data including our card ID

<figure class="ghost-figure"><img src="/img/ghost/what-is-an-api/image-2.webp" alt="" loading="lazy"><figcaption>Preview window showing the requests that returned the data rendered in the card</figcaption></figure>

So if we want to change some of the information about this card, we might wish to update the card list (also known as column) from "ToDo" to "Doing" as it happens in our Trello environment. Other list names that are common are "Backlog" and "Done"

## PUT - ing updates to cards

So we can drag our card across to the "Done" column, and we observe a new addition to the network log.  
In the trello docs, this new API action is documented a under the PUT verb [https://developer.atlassian.com/cloud/trello/rest/#api-cards-id-put](https://developer.atlassian.com/cloud/trello/rest/#api-cards-id-put)

We see a PUT request went to the `/1/cards/5e9ed7067dbdd871af184f98` URI to specify an action on this card with id `5e9ed7067dbdd871af184f98`

<figure class="ghost-figure"><img src="/img/ghost/what-is-an-api/image-3.webp" alt="" loading="lazy"><figcaption>Request for the API endpoint to update the list of the card with id 5e9ed7067dbdd871af184f98</figcaption></figure>

If we scroll down in the headers section, we see that our browser sent some FormData with a parameter specified as earlier, with `idList=5e65d2ef49b6dd5d75b1ba63` which happens to be the id of the "Doing" list

## PUT - ing cards into new columns

As before, suppose we want to move a card from one list to another. Using a bogus card that was created with an id of `5ea6c52046d1b9096f9ef84b` we can use the JavaScript console to send a fetch to the same API endpoint as before [https://developer.atlassian.com/cloud/trello/rest/#api-cards-id-put](https://developer.atlassian.com/cloud/trello/rest/#api-cards-id-put)

For the setup, I took the list ID after dragging the card between two lists, and then used the security token from the prior requests as well.

```
fetch("https://trello.com/1/cards/5ea6c52046d1b9096f9ef84b", {
    method: 'PUT', credentials: 'include', headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        'x-trello-client-version': 'build-4803',
        'x-trello-reqid': '5849fbbe0ccb7d611e55b70a' + "-" + Math.random(),
    }, body: 'token=5849fbbe0ccb7d611e55b70a/Pr747FQQeE4ikQuzngn43XuJf0E1nZemp6lX1neqX6eY6KTRkFK1oGMAYSM3SyrN&idList=5e7dc178910a628b27ca13c5'
})
    .then((response) => {
        return response.json();
    })
    .then((data) => {
        console.log(data);
    });
```

<figure class="ghost-figure"><img src="/img/ghost/what-is-an-api/image-4.webp" alt="" loading="lazy"><figcaption>Before making the request</figcaption></figure>

<figure class="ghost-figure"><img src="/img/ghost/what-is-an-api/image-5.webp" alt="" loading="lazy"><figcaption>After the request, including the server response. And I decided to leave the token in after I realised it becomes inactive once I log out. Go for it, try steal my session :D</figcaption></figure>

## POST - ing new cards

If we want to create a card like in 1. we can consult the "Create a new card" endpoint which we can POST at /1/cards [https://developer.atlassian.com/cloud/trello/rest/#api-cards-post](https://developer.atlassian.com/cloud/trello/rest/#api-cards-post)

Lets actually do this in Chrome without using the UI and just create it ourselves. If you are following along, we'll need that doing list id from earlier in order to create our card. I found the backlog id which was `5e65d2ef49b6dd5d75b1ba60`

```
fetch("https://trello.com/1/cards", {
    method: 'POST', credentials: 'include', headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        'x-trello-client-version': 'build-4803',
        'x-trello-reqid': '5849fbbe0ccb7d611e55b70a' + "-" + Math.random(),
    }, body: 'token=5849fbbe0ccb7d611e55b70a/Pr747FQQeE4ikQuzngn43XuJf0E1nZemp6lX1neqX6eY6KTRkFK1oGMAYSM3SyrN&name=New%20Card&desc=Some%20good%20description.&idList=5e65d2ef49b6dd5d75b1ba60'
})
    .then((response) => {
        return response.json();
    })
    .then((data) => {
        console.log(data);
    });
```

One interesting point of note, due to the collaborative features of Trello, we get a near instant update when we submit the fetch request to the server. This is because the Trello application has a WebSocket to allow communication between the server and our application. So after we tell the server to make a new card, shortly after the new card appears!

<figure class="ghost-figure"><img src="/img/ghost/what-is-an-api/image-7.webp" alt="" loading="lazy"><figcaption>The new card appears!</figcaption></figure>

Now, we can easily modify the above code examples and use the Trello documentation in order to move cards through the rest of the board, add Comments (under "Actions") and even archive the card if we're really over it.

Now with a practical example, reading API documentation shouldn't be as abstract, we can always tie any HTTP REST API back to the fundamental basics we covered in this short lab!
