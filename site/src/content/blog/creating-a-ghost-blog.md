---
title: "Creating a Ghost Blog"
description: "This site is running on Vultr on a VC2 instance running in Miami for $2.50 AUD"
date: 2018-04-16T09:34:27.000Z
tags: ["Technical"]
image: "/img/ghost/creating-a-ghost-blog/post-image.webp"
legacy: true
source: "https://chris.dilger.me/creating-a-ghost-blog/"
---

This site is running on [Vultr](https://www.vultr.com/?ref=7396293) on a VC2 instance running in Miami for $2.50 AUD

This setup is extremely economical and cheap, with a lot of flexibility. Steal and use for yourself. Stack from top to bottom:

-   Let's Encrypt SSL
-   Google Analytics
-   Cloud Flare CDN (Free Tier)
-   Ghost
-   MySQL
-   Nginx
-   Ubuntu 16.04 LTS
-   [Vultr](https://www.vultr.com/?ref=7396293)

If you want to install this for yourself, I provide a guide here to help both future me and yourself install a Ghost Blog.

1.  Choose a Miami instance to get the $2.50 cheapest tier, as unfortunately the $5 tier plans are cheapest everywhere else.
2.  Choose Ubuntu
3.  Don't forget to setup 2 factor authentication
4.  Set up SSH as per [the Vultur guide](https://www.vultr.com/docs/how-do-i-generate-ssh-keys/)
5.  Login via Putty to your new Ubuntu server
6.  Login to Cloudflare and set your registrar's DNS namserver settings appropriately. This can take some time
7.  Run this code as root:

    ```
    dd if=/dev/zero of=/var/swap bs=1k count=1024k
    mkswap /var/swap
    swapon /var/swap
    echo '/var/swap swap swap defaults 0 0' >> /etc/fstab
    ```

    Found [here](https://docs.ghost.org/docs/hosting#section-recommended-stack), which really screwed up my install. Errors were nondeterministic, unrepeatable and dependent on server load which took longer than it should have to solve.  
    Not once did anything tell me "You're out of RAM - try increasing your swap file"
8.  Follow this great guide at [https://docs.ghost.org/docs/install](https://docs.ghost.org/docs/install)
9.  Install a theme - by copying down the zip from GitHub. In the future I may create an addon for Ghost that will pull it straight from GitHub which I think would be useful
10.  Post about it?
11.  Setting up SSL on Cloudflare - Choose "Full Strict" since we have an SSL cert from Let's Encrypt on our Nginx server already

This exercise has opened up a large number of possibilies in the future. The main purpose of this blog over the next few months will be for upcoming travel experiences. In Malaysia and in the US, and this will likely be catalogued, including many specifics coming from the perspective of being an Australian university student.

Introductions done, welcome to a blog with a vague audience, very broad interests and will have little consistency other than using my life as source material.  
:smile:
