package io.freemytv.iptv

import java.io.InputStream
import java.io.StringReader
import java.util.GregorianCalendar
import java.util.TimeZone
import javax.xml.parsers.SAXParserFactory
import org.xml.sax.Attributes
import org.xml.sax.EntityResolver
import org.xml.sax.InputSource
import org.xml.sax.helpers.DefaultHandler

/**
 * The XMLTV guide.
 *
 * XMLTV is the standard the television guides are written in: a `<tv>` root, a `<channel>`
 * for every channel the guide names, and a `<programme>` for every thing that is on.
 *
 *     <tv>
 *       <channel id="bbc-one"><display-name>BBC One</display-name></channel>
 *       <programme start="20260101180000 +0000" stop="20260101183000 +0000" channel="bbc-one">
 *         <title>The News at Six</title><category>News</category>
 *       </programme>
 *     </tv>
 *
 * The parser is **SAX**, not DOM, and that is a decision about the television rather than
 * about elegance: the public feeds run to tens of megabytes, and a DOM of one of them
 * would take more memory than the television should spend on a guide. SAX reads it a
 * piece at a time. It is also the parser that Android and the JVM both have, so the same
 * code is the code the JVM test proves.
 */
object Xmltv {

    /** The guide in a string. */
    fun parse(text: String): Guide = parse(InputSource(StringReader(text)))

    /** The guide in a stream. The stream is read to the end and closed by the parser. */
    fun parse(stream: InputStream): Guide = parse(InputSource(stream))

    /** The guide, from a source. */
    fun parse(source: InputSource): Guide {
        val factory = SAXParserFactory.newInstance()
        factory.isNamespaceAware = false
        // The guide is a file from the internet: it must not be able to make the parser
        // read a local file or open a connection of its own.
        //
        // The DOCTYPE itself is **allowed**, because XMLTV files commonly carry one
        // (`<!DOCTYPE tv SYSTEM "xmltv.dtd">`) and refusing every DOCTYPE throws away
        // every provider's own guide for no gain. What is refused is the external
        // part of it: the entities and the DTD that would have to be fetched to
        // resolve them. Each feature is set on its own, because a parser that has
        // never heard of one is not a reason to fail the guide.
        for (feature in NO_EXTERNAL_ENTITIES) {
            try {
                factory.setFeature(feature, false)
            } catch (e: Exception) {
                // The parser does not know the feature.
            }
        }
        val handler = Handler()
        val parser = factory.newSAXParser()
        // Belt and braces for a parser that ignored the features above: anything
        // external resolves to nothing, so there is nothing to read.
        try {
            parser.xmlReader.entityResolver = EntityResolver { _, _ -> InputSource(StringReader("")) }
        } catch (e: Exception) {
            // The parser has no reader to set it on. The features above are the guard.
        }
        parser.parse(source, handler)
        return Guide(handler.channels, handler.programmes)
    }

    /**
     * An XMLTV time, in milliseconds since the epoch.
     *
     * The format is `yyyyMMddHHmmss` followed by a zone: `+0000`, or `Z`. The zone is
     * applied by hand rather than with `SimpleDateFormat`, which is lenient about what it
     * accepts and would read a broken time as a plausible one.
     */
    fun parseTime(raw: String?): Long {
        val text = raw?.filterNot { it.isWhitespace() } ?: return 0L
        if (text.length < 14) {
            return 0L
        }
        val year = text.substring(0, 4).toIntOrNull() ?: return 0L
        val month = text.substring(4, 6).toIntOrNull() ?: return 0L
        val day = text.substring(6, 8).toIntOrNull() ?: return 0L
        val hour = text.substring(8, 10).toIntOrNull() ?: return 0L
        val minute = text.substring(10, 12).toIntOrNull() ?: return 0L
        val second = text.substring(12, 14).toIntOrNull() ?: return 0L

        val calendar = GregorianCalendar(TimeZone.getTimeZone("UTC"))
        calendar.clear()
        calendar.set(year, month - 1, day, hour, minute, second)

        val zone = text.substring(14)
        var offsetMinutes = 0
        if (zone.length >= 5 && (zone[0] == '+' || zone[0] == '-')) {
            val hours = zone.substring(1, 3).toIntOrNull() ?: 0
            val minutes = zone.substring(3, 5).toIntOrNull() ?: 0
            offsetMinutes = hours * 60 + minutes
            if (zone[0] == '-') {
                offsetMinutes = -offsetMinutes
            }
        }
        return calendar.timeInMillis - offsetMinutes * 60_000L
    }

    /** Reads the guide's elements. */
    private class Handler : DefaultHandler() {

        val channels = mutableListOf<GuideChannel>()
        val programmes = mutableListOf<IptvProgramme>()

        private var inChannel = false
        private var inProgramme = false

        private var channelId = ""
        private var channelName = ""
        private var channelLogo = ""

        private var programmeChannel = ""
        private var programmeFrom = 0L
        private var programmeTo = 0L
        private var programmeTitle = ""
        private var programmeDescription = ""
        private var programmeCategory = ""

        /** The element whose text is being read, and the text itself. */
        private var textElement = ""
        private val text = StringBuilder()

        override fun startElement(uri: String?, localName: String?, qName: String?, attributes: Attributes) {
            when (qName) {
                "channel" -> {
                    inChannel = true
                    channelId = attributes.getValue("id") ?: ""
                    channelName = ""
                    channelLogo = ""
                }
                "icon" -> if (inChannel) {
                    channelLogo = attributes.getValue("src") ?: ""
                }
                "programme" -> {
                    inProgramme = true
                    programmeChannel = attributes.getValue("channel") ?: ""
                    programmeFrom = parseTime(attributes.getValue("start"))
                    programmeTo = parseTime(attributes.getValue("stop"))
                    programmeTitle = ""
                    programmeDescription = ""
                    programmeCategory = ""
                }
                "display-name", "title", "desc", "category" -> {
                    textElement = qName
                    text.setLength(0)
                }
            }
        }

        override fun characters(ch: CharArray?, start: Int, length: Int) {
            if (textElement.isEmpty() || ch == null) {
                return
            }
            text.append(ch, start, length)
        }

        override fun endElement(uri: String?, localName: String?, qName: String?) {
            when (qName) {
                "display-name" -> if (inChannel) {
                    channelName = text.toString().trim()
                }
                "channel" -> {
                    channels.add(GuideChannel(channelId, channelName, channelLogo))
                    inChannel = false
                }
                "title" -> if (inProgramme) {
                    programmeTitle = text.toString().trim()
                }
                "desc" -> if (inProgramme) {
                    programmeDescription = text.toString().trim()
                }
                "category" -> if (inProgramme) {
                    programmeCategory = text.toString().trim()
                }
                "programme" -> {
                    programmes.add(
                        IptvProgramme(
                            channelId = programmeChannel,
                            title = programmeTitle,
                            from = programmeFrom,
                            to = programmeTo,
                            description = programmeDescription,
                            category = programmeCategory,
                        ),
                    )
                    inProgramme = false
                }
            }
            if (qName == "display-name" || qName == "title" || qName == "desc" || qName == "category") {
                textElement = ""
            }
        }
    }

    /**
     * The parser features that stop a guide from reaching outside itself.
     *
     * A DOCTYPE is allowed — XMLTV files carry one often enough that refusing it would
     * throw away every provider's guide — but nothing outside the file is fetched to
     * resolve it.
     */
    private val NO_EXTERNAL_ENTITIES = arrayOf(
        "http://xml.org/sax/features/external-general-entities",
        "http://xml.org/sax/features/external-parameter-entities",
        "http://apache.org/xml/features/nonvalidating/load-external-dtd",
    )
}
