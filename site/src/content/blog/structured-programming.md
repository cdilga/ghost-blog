---
title: "Structured Programming"
description: "Edsger Dijkstra, a revolutionary computer scientist that produced several game-changing ideas for his time coined the term \"structured programming.\" (Dahl, Dijkstra & Hoare 1972)"
date: 2018-04-30T11:47:02.000Z
tags: ["Technical"]
image: "/img/ghost/structured-programming/IMG_0270.webp"
legacy: true
source: "https://chris.dilger.me/structured-programming/"
---

Edsger Dijkstra, a revolutionary computer scientist that produced several game-changing ideas for his time coined the term "structured programming." (Dahl, Dijkstra & Hoare 1972)

Dijkstra aimed to reduce the number of things a programmer had to hold in his head at any one time as he recognised the limitations of the human brain holding information at one time. Structured programming hinges upon the use of sequence, repetition, selection and modularisaiton in larger programs to allow people to instruct computers in a better way.

### Definitions

Sequence

Selection

Repetition

Modularisation

A program is a sequence of  
instructions. Sequence is the  
concept of one instruction  
following the next

Selection is the ability  
to branch the sequence

The ability to repeat  
parts of the sequence a  
number of times

Modularisation can create  
levels of abstraction, to  
reduce the amount of  
information a programmer  
must keep in his head

> Adapted from (Cain 2013)

## Defining problems for computers

Computers possess no inherent intelligence. To solve problems with computers, we first have to define the problem in a way that a computer can interact with. Take the real life example of music library management as an example. There are a range of requirements of a music management system, including storage, retrieval and perhaps even playback of media. If each song is stored on a Single Record we could point to each of the following distinct elements:

-   Song - Stored on some media containing only one individual song
-   Album - A collection of songs. There is some more information that applies to the songs when they are collected than when they are separate.
-   Music Library - Collection of music libraries

This physical world example is analogous to the music task in PT3.2, TextBasedMusicPlayer the management of a music library can be modelled by a computer.

### Variables, Constants and storing data in memory

Our music library has some associated data, whether it be the song name, vibrational encoding of the music itself or the genre of the music somehow it all must be stored. Computers use variables to store information, which can be visualised as a box. You can put a song name in a box, and get it out later to see what the song is called. Songs themselves can be put in boxes, so they can be accessed, which is a different data **type**. Examples of types in a traditional computing environment include **Integers** (numbers), **Strings** (text), and **Booleans** (true or false). Expanding on the concept of the variable is the concept of the Array, which can be through of as a collection of boxes in a line. Perhaps each record is put in it's own box, then each box is put inside of a larger box. This larger box we know as an album, as is shown in the below image

![A collection of Records, analagous to the Record datatype in a computer](https://c1.staticflickr.com/3/2664/4207951387_aa71bde81c_b.jpg#small)

> A record data structure is like a physical LP record, there is some information about the Artist, Year and the Single itself, all contained in an array, or box with a number of smaller containers inside.

At some point, just using these predefined types may not be enough. What if we need to store a song name, release year and artist all together? We can use a Record datatype, which is similar to the way in which written information is stored outside of the records. We can define our own fields, and then keep them attached to a song itself. All of these data types are stored inside of variables, whether it is a custom record, a array or basic datatype.

Finally, when the computer is storing all these abstract representations in it's memory, there are some advantages if the content is not allowed to change gained by declaring a `const` or constant which is assigned a value just like a variable, though is not able be updated after it is set like a variable.

## Sequence

Cooking is an every day activity that uses the concept of sequence to allow people to make food. When you are reading a recipe, you read left to right, top to bottom. When a computer reads code, it executes in much the same way. When baking a cake, you must:

1.  Crack Eggs
2.  Add eggs to mixture

Instruction 2. is completed after 1. Now we have an understanding of the concept of sequence, we can imagine a "recipe" for sorting our aforementioned music library organisation.

## Selection

When we're organising all of our singles into a large music library, we might have to make some decisions. If the disc cannot be found, don't add an empty case to our album. The `if` statement is the simplest decision structure, which instructs the computer to only execute code if an expression is true. An expression is a calculated value , calculates a value of true or false for the if statement.

There are cases where many if statements are required. Categorical information, such as the genre may be used to organise the albums, and in such a case would require multiple statements to check where to place the album. See in the filing cabinet below, we have a collection of albums represented by the drawers. When writing a recipe for someone to organise all of our music, in the case that genre is pop, put it in the following cabinet.  
![Filing Cabinet](https://image.ibb.co/mFLai5/cabinet_41038_960_720.png)

Example pseudo-code syntax:

```
case genre:
	genre is pop, then put the album in the pop cabinet
	genre is rock, then put the album in the rock drawer
	genre is metal, then put the album in the metal drawer
```

So, you can see instead of combining a large number of `if` statements, we can simply write one case statement to sort our albums.

## Repetition

After writing down a recipe for how to organise an entire music library, the list would contain many very similar instruction sets repeated over and over again. Repetition allows us to write code which will be run more than once. Writing `repeat until all albums classified into genre cabinets` after the case statement above would instruct our music librarian to keep doing this, with new albums until some condition was met. This is an example of a `repeat (until)` loop, where a block of code is run once, and will continue to run until some expression evaluates to false.

A `while` loop checks the condition before running the code, which means there is no guarantee the code is run. This difference could be important in some cases, perhaps reserving a new cabinet doesn't make sense to do once, if we find there are no albums to go into it.

The final type of loop is a for loop, which is very similar to a while loop with a variable that counts the number of iterations through the loop. Each time the loop is run, the expression that is evaluated checks that the counter is less than some predefined value.

## Modularisation

When we give instructions for organising our music library, we don't want to have to go into the details of how to open a box, sort through and find an album, pull it out, put it in some device to play, etc. We would like to be able to tell someone to simply play the album, give them the minimum amount of information required and allow them to complete it. That way, we aren't hampered by the knowledge that at this moment, they are pressing play on the disc player.

In a computer, we can group this code into a function or procedure. A function is a programming artefact which can calculate values from parameters passed to the function. If we gave our music librarian a recipe that requested a particular song be played, the text representing the song-name is the parameter. This means that the function or procedure is very much alike another program within the program. Where functions differ from procedures however, is when a function exits it will return some value which can then be stored in a variable.

## Conclusion

Structured programming has introduced an array of techniques for solving problems that allow programmers to use computers to solve more complex problems. Once the basis of sequence is established, conditional statements can be used to run code only when a condition is met. Repeated code can be placed into a loop, which will execute the code multiple times. When keeping track of all the parts of the problem becomes too difficult, use functions to do calculations for you, or procedures to delegate actions that don't need to report back an answer. Using modularisation, the program can be easily understood and still have a high degree of complexity. These

## Bibliography

Cain, A 2013, *Programming Arcana*.

Dahl, O-J, Dijkstra, EW & Hoare, CAR 1972, *Structured programming*, Academic Press Ltd., viewed 25 April, 2017, &lt;[http://dl.acm.org/citation.cfm?id=1243380](http://dl.acm.org/citation.cfm?id=1243380)\>.

McConnell, S 2004, *Code Complete: A Practical Handbook of Software Construction, Second Edition*, 2nd edition., Microsoft Press, Redmond, Wash.

Miller, GA 1956, ‘The magical number seven, plus or minus two: some limits on our capacity for processing information.’, *Psychological Review*, vol. 63, no. 2, pp. 81–97.

> Written with [StackEdit](https://stackedit.io/).
