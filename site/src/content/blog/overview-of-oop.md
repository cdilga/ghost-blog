---
title: "Overview of OOP"
description: "Background image - Map of OOP, fitting together some of the fundamental concepts of Object-Oriented Design"
date: 2018-05-02T09:46:00.000Z
tags: ["Technical"]
image: "/img/ghost/overview-of-oop/oop-graph.webp"
legacy: true
source: "https://chris.dilger.me/overview-of-oop/"
---

## OOP Programming Concepts

> Background image - Map of OOP, fitting together some of the fundamental concepts of Object-Oriented Design

Concepts in Object-Oriented Programming have been subject to a number of iterations from an initial investment of SIMULA, which aimed to run simulations of real world events. Similar to when industry began using procedural programming to conceptually isolate parts of problems, Object oriented design delivered a number of improvements over existing procedural programming practices. Abstraction and encapsulation are underpinning concepts which make resulting objects in a program scale better and remain maintainable and extensible.

Drawing from examples in the “Object Oriented Programming” Unit at Swinburne throughout this explanation, it is natural that the type of Object-Oriented concepts are understood as they are present in the C# language. Whilst there are some languages, like JavaScript without classes or strict type checking the general concepts outlined here are still useful in a more general sense.

## Objects

All object oriented languages will feature at its conceptual core the object. Generally an object is a collection of data, which has an associated set of methods that can operate on that data. These objects are created from a set of rules specified in a Class, which can be thought of conceptually as the template from which new objects are made. A class defines both the data (fields) and behaviours of an object (methods). Even with such a limited outline of object oriented design we can already apply this concept to a real problem.  
Say we have an adventure game, which has a player, some items and a backpack. First we specify that everything in our game must be able to answer the question, “What is your name?” Including a GameObject, shown figure 2 we can ensure that any derived class will implement a Name property.

![Class based Inheritance with 3 distinct objects and an aggregation](/img/ghost/overview-of-oop/uml.webp)

> Figure 2. UML Diagram — Class based Inheritance with 3 distinct objects and an aggregation  
> The Player, Item and Bag all inherit from the GameObject class, which means that each of them will have the name property automatically. Each of these classes can be an individual file, and so the code for the Name property is only located in one place. Inheritance is used if the objects in question follow an “is a” relationship, in our case we would state that “A Player is a GameObject.”

Additionally, in Fig. 2 we can see our Bag has a List called Items. Polymorphism is the concept of treating one object as a kind of another. Each of the three derived classes have a contract with GameObject to implement the Name property, and thus we can treat each of them as a GameObject and ask for their name without worrying what each object actually is. This means that we can put a Player, Item and another Bag inside of our bag object in the Items list.

## Abstraction

The quote, “Everything is an object,” describes how universally the abstractions provided by thinking about problems in terms of objects can be applied. Designing objects and classes is somewhat subjective, though this is balanced by a collection of heuristic approaches to decompose a problem into objects with specific behaviours and knowledge. When objects collaborate, or are used together in a program a strong awareness of the roles of each of the objects at design time is important.  
Building a shape drawing program required consideration of the roles. Consider the following objects in Figure 3:

![Good abstraction keeps the design extensible and is consistent — drawing is a Shape behaviour](/img/ghost/overview-of-oop/uml-fig3.webp)

> Figure 3. Good abstraction keeps the design extensible and is consistent — drawing is a Shape behaviour  
> Here we see that each shape forms a consistent abstraction, enforced using an abstract superclass. Drawing is a responsibility of each of the shapes, which means all of the data and knowledge about the drawing that needs to be known can happen within that Shape object. The role of the drawing object is clearly to tell all of the shapes to draw themselves, and to keep a track of all of the shapes, where the shapes have a well defined role in which the shape itself is drawn.

## Encapsulation

Debates on the differences between Encapsulation and Abstraction are common amongst members of the developer community. The most supportable position however has some common elements, Encapsulation is a type of abstraction that ensures that information is hidden and well contained. When a Rectangle is abstracted in Figure 3. we see that all of the information about how to draw it, that is the width and the height is contained within the Rectangle object itself. Passing this information along to the Draw method would be an example of poor encapsulation and tight coupling, as the Drawing object now must keep track of the information that is better stored where other objects cannot view or modify this field within the object.

Keeping related information in object that the methods directly access is an example of the desirable trait of cohesion. An object is said to be cohesive if the methods and data are closely related. Generally, loosely coupled classes also be cohesive. As in the aforementioned example a Drawing class that keeps track of each of the Shape’s width and height will not be highly cohesive — the Render method of the Drawing must deal with information that has nothing to do with the Drawing object.

## “Good” Object-Oriented Design?

All object oriented design is not an objective process in many cases, as the run-time efficiency, delivery timelines, code maintainability and associated traits must be evaluated on a case by case basis. Design patterns, such as the Observer pattern and Architectural patterns like the massively popular Model View Controller are reusable and well thought out designs which developers can select and implement to solve a particular problem.

In the case of an event system, we have a series of objects that can respond to changes in a certain event, say a user click. We allow each object to “register” by passing a reference to a function on the object — such as an Update() method which is then called when the button or other UI element receives a click event. The reason patterns like these exist is that certain types of problems recur, and thus practitioners of object oriented design have constructed generally applicable solutions that keep object designs loosely coupled and highly cohesive by their nature.

Even once a developer or software engineer has an awareness of a number of ways of thinking about designing programs, the skill in development lies in the ability to manage the competing forces previously mentioned of object oriented design.
