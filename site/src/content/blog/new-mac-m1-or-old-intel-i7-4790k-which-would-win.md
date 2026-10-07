---
title: "New Mac M1 or old Intel i7 4790k - Which would win?"
description: "When the new 2020 model MacBooks were announced, I was not waiting eagerly like some of the Apple fans. I first heard some of the hype from people I knew who were buying these…"
date: 2021-08-23T23:06:05.000Z
tags: []
image: "/img/ghost/new-mac-m1-or-old-intel-i7-4790k-which-would-win/mac-1769720768010-85bc9447.webp"
legacy: true
source: "https://chris.dilger.me/new-mac-m1-or-old-intel-i7-4790k-which-would-win/"
---

When the new 2020 model MacBooks were announced, I was not waiting eagerly like some of the Apple fans. I first heard some of the hype from people I knew who were buying these new laptops, and were claiming insane performance specs on a laptop. I was inherently skeptical, and didn't really give it a second thought, until much later. What really got my attention though, was an in-depth article talking about the new ARM architecture, which gave the laptop fast responses, excellent battery life and a low cost. Somehow, this M1 chip was doing it all *without a fan*.

I've been avoiding the premium and restrictive Apple life for the last 10 years. As a kid, I recall being used as free labor to print family photo albums for my parents using an old bubble blue iMac. That's right, *that* iMac. I really felt that the Apple design experience limited my ability to solve problems and use the technology I paid for. Now the M1 looked like a change from this principle. It seemed to be the best in almost all categories, and somehow not be much more expensive than the competition. So let's start with some benchmarks.

Let's compare an Intel i7 4790k CPU that I currently use for my desktop with this shiny new M1 chip from 2020.

## **Tests**

The tests were chosen to simulate both intensive graphical and CPU workloads, in addition to testing the general user experience of using the computer for things most people use computers for. So no crazy machine learning tests yet.

Each computer was set up running only the test, and it was repeated twice. The computer was turned off and on before each test to make sure there weren't any rogue processes using up all the resources.

**Cinebench Results**

<figure class="ghost-figure"><img src="https://lh5.googleusercontent.com/mKuqnSXRBjVEeNCQner98WE3R6zf2-Sib9YUzITvbVNQTZXqUwBVM3ZcXbvAGp81u-Nw9bLheo5AWnJNRZfdlRfl8Gg1bpsFU0_qBn1Dsooedb6BHfGdboE17anB9BnVtvxKR3pl=s0" alt="" loading="lazy"><figcaption>Multithreaded Cinebench test result of 6718</figcaption></figure>

<figure class="ghost-figure"><img src="https://lh4.googleusercontent.com/ECLvMDXQ7ZDoT1oEb8taIEcAtTSoX-ejVm46JN4g4In2XISNM_OoR6uDWNZVdNJ4KXmzSg5r0fZOy730-5mRq5t2ZoPbYYzISS0kYN5lsX7HPWH6MIgjIkbXNnF-U2xho2Z_FG70=s0" alt="" loading="lazy"><figcaption>Singlethreaded Cinebench test result of 4505</figcaption></figure>

It's amazing that the M1 performs at least 50% better in both tests! The architecture of the i7 means there are 4 cores each with 2 hyper threads, so it's not particularly surprising that the 8 core can beat the 4 core, 5 year old chip. But what is suprising, is that the 4 high performance cores in the M1 chip outperform the intel chip. This is really amazing, as even today the defining feature of intel CPU's has always been the best in class single threaded performance. Of course, it's not fair to compare such an old chip. But still.

One interesting results is the comparison to other CPU's. The M1 chip ranked right next to an 11th generation, or 1 year old Intel i7 1165 G CPU, which is incredible. It's literally beating the intel. And what's more amazing, is that the benchmark was not optimised for the M1 hardware.

**BrowserBench Results**

Now, let's use something real world that we use every day. Browser bench is a test that simulates the modern browser experience, which most users will be doing [more than 3 hours per day](https://www.statista.com/statistics/416850/average-duration-of-internet-use-age-device/). Both tests were conducted with the latest build of Brave 1.25.73.

Each run has an automated set of user actions and page refreshes, simulating average modern web applications, which might include messaging apps, banking applications or trading platforms. For the benchmark, it uses React with an example todo list application for task management.

<figure class="ghost-figure"><img src="https://lh4.googleusercontent.com/YxWnrhf62XU5BYtV-BXnAU_cqQbDRDxL6oOXYowZU18VYZ4hIBh5gY_fxLwcfxj0e6coake6qmumOX2aQ7q4aYzmkCQci2RD437Vbqab1Y5gNaBCnr4SiD88KM27Fp1O_icXYrDZ=s0" alt="" loading="lazy"><figcaption>Browserbench test result of 162 actions per minute</figcaption></figure>

[Jinho Jeong](https://tech.ssut.me/apple-m1-chip-benchmarks-focused-on-the-real-world-programming/) 说苹果的晶片很适合当一台可以用很久、高性能、非常好携带、开发者笔电。现在苹果从其他公司学到了怎么做一台优秀的笔电。做得好🍎。

Just as [Jinho Jeong](https://tech.ssut.me/apple-m1-chip-benchmarks-focused-on-the-real-world-programming/) says, this Apple Silicon chip is great for a low power, relatively high performance dev machine that is ultra portable. It seems that now, Apple has learned the lessons of failed ARM architectures in the surface and google lineup, and delivered a cost effective, efficient and performance product with a premium feel. Well done 🍎

In part 2, I will compare the machine learning capabilities of a GTX 1080 8GB with the M1 chip, using TensorFlow. A flagship gaming GPU of years past vs a dedicated NPU with library optimisation! I'm excited.

## **Tools:**

Browser Speedtest: [https://browserbench.org/Speedometer2.0/](https://browserbench.org/Speedometer2.0/)

Cinebench: [https://www.maxon.net/en/cinebench/](https://www.maxon.net/en/cinebench/)
